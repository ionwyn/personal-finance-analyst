import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SPENDING_FILTER } from "@/lib/spending/classify";

export type CycleHistoryRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  incomeReceived: Prisma.Decimal;
  fixedSavingsPull: Prisma.Decimal;
  sweptAmount: Prisma.Decimal;
  totalSaved: Prisma.Decimal;
  spent: Prisma.Decimal;
  carryover: Prisma.Decimal;
  closedAt: Date | null;
};

export async function getCycleHistory(tenantId: string, limit = 24): Promise<CycleHistoryRow[]> {
  const cycles = await prisma.payCycle.findMany({
    where: { tenantId },
    orderBy: { startDate: "desc" },
    take: limit,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      incomeReceived: true,
      fixedSavingsPull: true,
      sweptAmount: true,
      carryover: true,
      closedAt: true
    }
  });

  if (!cycles.length) return [];

  const cycleIds = cycles.map((c) => c.id);
  const spentRows = await prisma.plaidTransaction.groupBy({
    by: ["cycleId"],
    where: { ...SPENDING_FILTER, tenantId, cycleId: { in: cycleIds } },
    _sum: { amount: true }
  });

  const spentByCycle = new Map<string, Prisma.Decimal>();
  for (const row of spentRows) {
    if (row.cycleId) spentByCycle.set(row.cycleId, row._sum.amount ?? new Prisma.Decimal(0));
  }

  return cycles.map((c) => {
    const incomeReceived = c.incomeReceived ?? new Prisma.Decimal(0);
    const fixedSavingsPull = c.fixedSavingsPull ?? new Prisma.Decimal(0);
    const sweptAmount = c.sweptAmount ?? new Prisma.Decimal(0);
    const spent = spentByCycle.get(c.id) ?? new Prisma.Decimal(0);

    return {
      id: c.id,
      startDate: c.startDate,
      endDate: c.endDate,
      incomeReceived,
      fixedSavingsPull,
      sweptAmount,
      totalSaved: fixedSavingsPull.add(sweptAmount),
      spent,
      carryover: c.carryover,
      closedAt: c.closedAt
    };
  });
}
