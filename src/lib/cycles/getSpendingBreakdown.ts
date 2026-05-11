import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type SpendingBreakdownRow = {
  categoryId: string | null;
  category: string;
  color: string;
  amount: number;
  pct: number;
  delta: number | null;
};

export type SpendingBreakdownData = {
  rows: SpendingBreakdownRow[];
  total: number;
  previousTotal: number;
  discretionarySpent: number;
  discretionaryBudget: number;
  discretionaryRemaining: number;
};

const FALLBACK_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)"
];

const UNCATEGORIZED = "Uncategorized";

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

async function spendByCategory(tenantId: string, cycleId: string) {
  const rows = await prisma.plaidTransaction.groupBy({
    by: ["categoryId"],
    where: {
      tenantId,
      cycleId,
      removed: false,
      supersededById: null,
      txnType: "expense"
    },
    _sum: { amount: true }
  });
  const map = new Map<string | null, number>();
  for (const r of rows) {
    map.set(r.categoryId, num(r._sum.amount));
  }
  return map;
}

export async function getSpendingBreakdown(
  tenantId: string,
  cycleId: string,
  previousCycleId: string | null,
  discretionaryBudget: number
): Promise<SpendingBreakdownData> {
  const [categories, currentMap, previousMap] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId },
      select: { id: true, name: true, color: true }
    }),
    spendByCategory(tenantId, cycleId),
    previousCycleId ? spendByCategory(tenantId, previousCycleId) : Promise.resolve(new Map())
  ]);

  const catLookup = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));
  const total = [...currentMap.values()].reduce((s, v) => s + v, 0);
  const previousTotal = [...previousMap.values()].reduce((s, v) => s + v, 0);

  const rows: SpendingBreakdownRow[] = [];
  let fallbackIndex = 0;

  for (const [categoryId, amount] of currentMap.entries()) {
    if (amount <= 0) continue;
    const cat = categoryId ? catLookup.get(categoryId) : null;
    const previousAmount = previousMap.get(categoryId) ?? 0;
    rows.push({
      categoryId,
      category: cat?.name ?? UNCATEGORIZED,
      color: cat?.color ?? FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length],
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
      delta: previousAmount > 0 ? amount - previousAmount : null
    });
  }

  rows.sort((a, b) => b.amount - a.amount);

  const discretionarySpent = total;
  const discretionaryRemaining = discretionaryBudget - discretionarySpent;

  return {
    rows,
    total,
    previousTotal,
    discretionarySpent,
    discretionaryBudget,
    discretionaryRemaining
  };
}

export async function findPreviousCycleId(tenantId: string, currentStartDate: Date): Promise<string | null> {
  const prev = await prisma.payCycle.findFirst({
    where: { tenantId, endDate: { lt: currentStartDate } },
    orderBy: { startDate: "desc" },
    select: { id: true }
  });
  return prev?.id ?? null;
}
