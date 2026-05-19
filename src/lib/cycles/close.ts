import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recomputeCycleTotals } from "@/lib/cycles/recomputeTotals";
import { SPENDING_FILTER } from "@/lib/spending/classify";

async function firstCreditTransactionDate(tenantId: string) {
  const first = await prisma.plaidTransaction.findFirst({
    where: {
      tenantId,
      removed: false,
      supersededById: null,
      account: { type: "credit" },
    },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first?.date ?? null;
}

async function carryoverBaselineDate(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { createdAt: true },
  });
  return tenant?.createdAt ?? null;
}

/**
 * Compute and persist carryover for any cycles that ended before `now`.
 * Existing closed cycles are recalculated so late syncs/reclassification cannot
 * leave a stale cumulative carryover in history.
 * Cycles that ended before the tenant was created are imported history, so their
 * app-specific carryover is pinned to zero.
 *
 * Formula (per PHASE2.md §2.7):
 *   closed.carryover =
 *       previous.carryover
 *     + incomeReceived
 *     − fixedSavingsPull
 *     − sweptAmount
 *     − sum(expense transactions in this cycle)
 *     − card payments before credit-card transaction history begins
 *
 * The active cycle's safe-to-sweep reads the most recent closed cycle's
 * carryover as an offset; we do not mutate future cycles here.
 */
export async function closeOverdueCycles(tenantId: string, now: Date = new Date()) {
  const overdueIds = await prisma.payCycle.findMany({
    where: { tenantId, endDate: { lt: now } },
    orderBy: { startDate: "asc" },
    select: { id: true },
  });

  if (!overdueIds.length) return 0;

  for (const cycle of overdueIds) {
    await recomputeCycleTotals(tenantId, cycle.id);
  }

  const overdue = await prisma.payCycle.findMany({
    where: { tenantId, endDate: { lt: now } },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      incomeReceived: true,
      fixedSavingsPull: true,
      sweptAmount: true,
      carryover: true,
      closedAt: true,
    },
  });

  let closed = 0;
  let previousCarryover: Prisma.Decimal | null = null;
  const creditHistoryStart = await firstCreditTransactionDate(tenantId);
  const baselineDate = await carryoverBaselineDate(tenantId);

  for (const cycle of overdue) {
    const isImportedHistory = baselineDate ? cycle.endDate < baselineDate : false;
    if (isImportedHistory) {
      if (!cycle.carryover.equals(0) || !cycle.closedAt) {
        await prisma.payCycle.update({
          where: { id: cycle.id },
          data: { carryover: new Prisma.Decimal(0), closedAt: cycle.closedAt ?? now },
        });
      }
      if (!cycle.closedAt) closed += 1;
      previousCarryover = new Prisma.Decimal(0);
      continue;
    }

    if (previousCarryover == null) {
      const prev = await prisma.payCycle.findFirst({
        where: {
          tenantId,
          endDate: {
            lt: cycle.startDate,
            ...(baselineDate ? { gte: baselineDate } : {}),
          },
          closedAt: { not: null },
        },
        orderBy: { startDate: "desc" },
        select: { carryover: true },
      });
      previousCarryover = prev?.carryover ?? new Prisma.Decimal(0);
    }

    const expenseAgg = await prisma.plaidTransaction.aggregate({
      where: { ...SPENDING_FILTER, tenantId, cycleId: cycle.id },
      _sum: { amount: true },
    });

    const shouldCountSettlements = !creditHistoryStart || cycle.endDate < creditHistoryStart;
    const settlementAgg = shouldCountSettlements
      ? await prisma.plaidTransaction.aggregate({
          where: {
            tenantId,
            cycleId: cycle.id,
            removed: false,
            supersededById: null,
            txnType: "settlement",
          },
          _sum: { amount: true },
        })
      : null;

    const expenses = expenseAgg._sum.amount ?? new Prisma.Decimal(0);
    const unbackedSettlements = settlementAgg?._sum.amount ?? new Prisma.Decimal(0);
    const incomeReceived = cycle.incomeReceived ?? new Prisma.Decimal(0);
    const fixedSavingsPull = cycle.fixedSavingsPull ?? new Prisma.Decimal(0);
    const sweptAmount = cycle.sweptAmount ?? new Prisma.Decimal(0);

    const newCarryover = previousCarryover
      .add(incomeReceived)
      .sub(fixedSavingsPull)
      .sub(sweptAmount)
      .sub(expenses)
      .sub(unbackedSettlements);

    if (!cycle.carryover.equals(newCarryover) || !cycle.closedAt) {
      await prisma.payCycle.update({
        where: { id: cycle.id },
        data: { carryover: newCarryover, closedAt: cycle.closedAt ?? now },
      });
    }

    if (!cycle.closedAt) closed += 1;
    previousCarryover = newCarryover;
  }

  return closed;
}

/**
 * Read the carryover offset to apply to safe-to-sweep for the active cycle.
 * Returns the most recent closed cycle's carryover, or zero if none have closed.
 */
export async function getActiveCarryover(tenantId: string, activeCycleStart: Date) {
  const baselineDate = await carryoverBaselineDate(tenantId);
  const prev = await prisma.payCycle.findFirst({
    where: {
      tenantId,
      endDate: {
        lt: activeCycleStart,
        ...(baselineDate ? { gte: baselineDate } : {}),
      },
      closedAt: { not: null },
    },
    orderBy: { startDate: "desc" },
    select: { carryover: true },
  });
  return prev?.carryover ?? new Prisma.Decimal(0);
}
