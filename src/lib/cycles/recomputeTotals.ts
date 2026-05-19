import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function recomputeCycleTotals(tenantId: string, cycleId: string) {
  const agg = await prisma.plaidTransaction.groupBy({
    by: ["txnType"],
    where: {
      tenantId,
      cycleId,
      removed: false,
      supersededById: null,
      txnType: { in: ["income", "savings"] },
    },
    _sum: { amount: true },
  });

  const incomeRaw = agg.find((r) => r.txnType === "income")?._sum.amount ?? null;
  const savingsRaw = agg.find((r) => r.txnType === "savings")?._sum.amount ?? null;

  await prisma.payCycle.update({
    where: { id: cycleId },
    data: {
      incomeReceived: incomeRaw ? incomeRaw.abs() : new Prisma.Decimal(0),
      fixedSavingsPull: savingsRaw ? savingsRaw.abs() : new Prisma.Decimal(0),
    },
  });
}
