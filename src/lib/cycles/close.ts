import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SPENDING_FILTER } from "@/lib/spending/classify";

/**
 * Compute and persist carryover for any cycles that ended before `now` and have
 * not yet been closed. Idempotent — only runs once per cycle (gated by
 * closedAt). Each cycle's stored `carryover` is cumulative: it includes the
 * prior closed cycle's carryover plus this cycle's net.
 *
 * Formula (per PHASE2.md §2.7):
 *   closed.carryover =
 *       previous.carryover
 *     + incomeReceived
 *     − fixedSavingsPull
 *     − sweptAmount
 *     − sum(expense transactions in this cycle)
 *
 * The active cycle's safe-to-sweep reads the most recent closed cycle's
 * carryover as an offset; we do not mutate future cycles here.
 */
export async function closeOverdueCycles(tenantId: string, now: Date = new Date()) {
  const overdue = await prisma.payCycle.findMany({
    where: { tenantId, closedAt: null, endDate: { lt: now } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      incomeReceived: true,
      fixedSavingsPull: true,
      sweptAmount: true
    }
  });

  if (!overdue.length) return 0;

  let closed = 0;

  for (const cycle of overdue) {
    const prev = await prisma.payCycle.findFirst({
      where: { tenantId, endDate: { lt: cycle.startDate }, closedAt: { not: null } },
      orderBy: { startDate: "desc" },
      select: { carryover: true }
    });
    const prevCarryover = prev?.carryover ?? new Prisma.Decimal(0);

    const expenseAgg = await prisma.plaidTransaction.aggregate({
      where: { ...SPENDING_FILTER, tenantId, cycleId: cycle.id },
      _sum: { amount: true }
    });

    const expenses = expenseAgg._sum.amount ?? new Prisma.Decimal(0);
    const incomeReceived = cycle.incomeReceived ?? new Prisma.Decimal(0);
    const fixedSavingsPull = cycle.fixedSavingsPull ?? new Prisma.Decimal(0);
    const sweptAmount = cycle.sweptAmount ?? new Prisma.Decimal(0);

    const newCarryover = prevCarryover
      .add(incomeReceived)
      .sub(fixedSavingsPull)
      .sub(sweptAmount)
      .sub(expenses);

    await prisma.payCycle.update({
      where: { id: cycle.id },
      data: { carryover: newCarryover, closedAt: now }
    });

    closed += 1;
  }

  return closed;
}

/**
 * Read the carryover offset to apply to safe-to-sweep for the active cycle.
 * Returns the most recent closed cycle's carryover, or zero if none have closed.
 */
export async function getActiveCarryover(tenantId: string, activeCycleStart: Date) {
  const prev = await prisma.payCycle.findFirst({
    where: { tenantId, endDate: { lt: activeCycleStart }, closedAt: { not: null } },
    orderBy: { startDate: "desc" },
    select: { carryover: true }
  });
  return prev?.carryover ?? new Prisma.Decimal(0);
}
