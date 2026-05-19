import { format, startOfMonth, startOfYear, subMonths, subYears } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashColor } from "@/lib/spending/color";
import { incomeWhere, spendingWhere } from "@/lib/spending/classify";

export type Period = "MTD" | "YTD";

export type DetailedRow = {
  name: string;
  detailedRaw: string;
  amount: number;
  prevAmount: number;
};

export type CategoryRow = {
  primary: string;
  primaryRaw: string;
  amount: number;
  prevAmount: number;
  pctOfIncome: number;
  color: string;
  detailed: DetailedRow[];
};

export type SpendingInsightData = {
  period: Period;
  periodLabel: string;
  prevPeriodLabel: string;
  rangeStart: Date;
  rangeEnd: Date;
  prevRangeStart: Date;
  prevRangeEnd: Date;
  totalSpending: number;
  prevTotalSpending: number;
  totalIncome: number;
  prevTotalIncome: number;
  categories: CategoryRow[];
};

const UNCATEGORIZED = "Uncategorized";

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function formatCategoryName(raw: string | null): string {
  if (!raw) return UNCATEGORIZED;
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeRanges(period: Period, now: Date) {
  if (period === "MTD") {
    const rangeStart = startOfMonth(now);
    const rangeEnd = now;
    const prevRangeStart = startOfMonth(subMonths(now, 1));
    const prevRangeEnd = subMonths(now, 1);
    return {
      rangeStart,
      rangeEnd,
      prevRangeStart,
      prevRangeEnd,
      periodLabel: format(now, "MMMM yyyy"),
      prevPeriodLabel: format(subMonths(now, 1), "MMMM yyyy"),
    };
  }
  const rangeStart = startOfYear(now);
  const rangeEnd = now;
  const prevRangeStart = startOfYear(subYears(now, 1));
  const prevRangeEnd = subYears(now, 1);
  return {
    rangeStart,
    rangeEnd,
    prevRangeStart,
    prevRangeEnd,
    periodLabel: `${format(now, "yyyy")} YTD`,
    prevPeriodLabel: `${format(subYears(now, 1), "yyyy")} YTD (to ${format(prevRangeEnd, "MMM d")})`,
  };
}

async function spendByPrimary(tenantId: string, gte: Date, lt: Date) {
  const rows = await prisma.plaidTransaction.groupBy({
    by: ["categoryPrimary"],
    where: spendingWhere(tenantId, gte, lt),
    _sum: { amount: true },
  });
  const map = new Map<string | null, number>();
  for (const r of rows) {
    map.set(r.categoryPrimary, Math.max(0, num(r._sum.amount)));
  }
  return map;
}

async function spendByDetailed(tenantId: string, gte: Date, lt: Date) {
  const rows = await prisma.plaidTransaction.groupBy({
    by: ["categoryPrimary", "categoryDetailed"],
    where: spendingWhere(tenantId, gte, lt),
    _sum: { amount: true },
  });
  const map = new Map<string | null, Map<string | null, number>>();
  for (const r of rows) {
    const inner = map.get(r.categoryPrimary) ?? new Map<string | null, number>();
    inner.set(r.categoryDetailed, Math.max(0, num(r._sum.amount)));
    map.set(r.categoryPrimary, inner);
  }
  return map;
}

async function incomeTotal(tenantId: string, gte: Date, lt: Date) {
  const agg = await prisma.plaidTransaction.aggregate({
    where: incomeWhere(tenantId, gte, lt),
    _sum: { amount: true },
  });
  // credits are negative — flip the sign to get a positive income total
  return Math.max(0, -num(agg._sum.amount));
}

export async function getSpendingInsight(
  tenantId: string,
  period: Period
): Promise<SpendingInsightData> {
  const now = new Date();
  const ranges = computeRanges(period, now);

  const [currentPrimary, prevPrimary, currentDetailed, prevDetailed, totalIncome, prevTotalIncome] =
    await Promise.all([
      spendByPrimary(tenantId, ranges.rangeStart, ranges.rangeEnd),
      spendByPrimary(tenantId, ranges.prevRangeStart, ranges.prevRangeEnd),
      spendByDetailed(tenantId, ranges.rangeStart, ranges.rangeEnd),
      spendByDetailed(tenantId, ranges.prevRangeStart, ranges.prevRangeEnd),
      incomeTotal(tenantId, ranges.rangeStart, ranges.rangeEnd),
      incomeTotal(tenantId, ranges.prevRangeStart, ranges.prevRangeEnd),
    ]);

  const totalSpending = [...currentPrimary.values()].reduce((s, v) => s + v, 0);
  const prevTotalSpending = [...prevPrimary.values()].reduce((s, v) => s + v, 0);

  const primaryKeys = new Set<string | null>([...currentPrimary.keys(), ...prevPrimary.keys()]);

  const categories: CategoryRow[] = [];
  for (const key of primaryKeys) {
    const amount = currentPrimary.get(key) ?? 0;
    const prevAmount = prevPrimary.get(key) ?? 0;
    if (amount <= 0 && prevAmount <= 0) continue;

    const primaryName = formatCategoryName(key);
    const currentInner = currentDetailed.get(key);
    const prevInner = prevDetailed.get(key);
    const detailedKeys = new Set<string | null>([
      ...(currentInner?.keys() ?? []),
      ...(prevInner?.keys() ?? []),
    ]);

    const detailed: DetailedRow[] = [];
    for (const dKey of detailedKeys) {
      const dAmount = currentInner?.get(dKey) ?? 0;
      const dPrev = prevInner?.get(dKey) ?? 0;
      if (dAmount <= 0 && dPrev <= 0) continue;
      detailed.push({
        name: formatCategoryName(dKey),
        detailedRaw: dKey ?? "",
        amount: dAmount,
        prevAmount: dPrev,
      });
    }
    detailed.sort((a, b) => b.amount - a.amount);

    categories.push({
      primary: primaryName,
      primaryRaw: key ?? "",
      amount,
      prevAmount,
      pctOfIncome: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      color: hashColor(primaryName),
      detailed,
    });
  }

  categories.sort((a, b) => b.amount - a.amount);

  return {
    period,
    periodLabel: ranges.periodLabel,
    prevPeriodLabel: ranges.prevPeriodLabel,
    rangeStart: ranges.rangeStart,
    rangeEnd: ranges.rangeEnd,
    prevRangeStart: ranges.prevRangeStart,
    prevRangeEnd: ranges.prevRangeEnd,
    totalSpending,
    prevTotalSpending,
    totalIncome,
    prevTotalIncome,
    categories,
  };
}
