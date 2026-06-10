import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  CATEGORY_COLORS,
  colorForCategory,
  delta,
  hash,
  isLiabilityType,
  monthKey,
  numberValue,
} from "@/lib/analytics/dashboard-helpers";
import {
  buildBalanceByDay,
  buildBalanceHistory,
  buildBalanceSpark,
  computeBalanceDelta,
} from "@/lib/analytics/balance";
import {
  mapAccountSummary,
  mapInstitutionSummary,
  mapPlaidItemSummary,
} from "@/lib/analytics/mappers";
import {
  aggregateTransactions,
  buildCategorySpend,
  buildMerchantSpend,
} from "@/lib/analytics/transactions-aggregator";
import type {
  AccountSummary,
  BalancePoint,
  CategorySpend,
  InstitutionSummary,
  MerchantSpend,
  MonthlyCashflow,
  PlaidItemSummary,
  TransactionSummary,
} from "@/lib/analytics/types";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import type { InvestmentDashboardData } from "@/lib/investments/types";
import { categorizeForSpending } from "@/lib/spending/classify";

export type {
  AccountSummary,
  BalancePoint,
  CategorySpend,
  InstitutionSummary,
  MerchantSpend,
  MonthlyCashflow,
  PlaidItemSummary,
  TransactionSummary,
};

function emptyDashboardData(slug: string, investments: InvestmentDashboardData) {
  return {
    tenantSlug: slug,
    hasTenant: false,
    totals: {
      accountCount: 0,
      transactionCount: 0,
      currentBalance: investments.summary.portfolioCAD,
      cashBalance: 0,
      investmentBalance: investments.summary.portfolioCAD,
      totalAssets: investments.summary.portfolioCAD,
      totalLiabilities: 0,
      monthlySpend: 0,
      monthlyIncome: 0,
      netCashflow: 0,
    },
    deltas: {
      balance: null as number | null,
      income: null as number | null,
      spend: null as number | null,
      cashflow: null as number | null,
    },
    sparks: {
      balance: [] as number[],
      income: [] as number[],
      spend: [] as number[],
      cashflow: [] as number[],
    },
    insights: {
      avgDailySpend: 0,
      largestExpense: null as { name: string; amount: number; date: string } | null,
      subscriptionsTotal: 0,
      subscriptionsCount: 0,
      savingsRate: null as number | null,
      daysRemaining: 0,
      monthExpenseCount: 0,
      daysElapsed: 0,
      daysInMonth: 30,
    },
    institutions: [] as InstitutionSummary[],
    accounts: [] as AccountSummary[],
    plaidItems: [] as PlaidItemSummary[],
    recentTransactions: [] as TransactionSummary[],
    monthlyCashflow: [] as MonthlyCashflow[],
    categorySpend: [] as CategorySpend[],
    categorySpend30d: [] as CategorySpend[],
    categorySpendMTD: [] as CategorySpend[],
    categorySpend7d: [] as CategorySpend[],
    merchantSpend: [] as MerchantSpend[],
    balanceHistory: [] as BalancePoint[],
    investments,
    currentMonthLabel: format(new Date(), "MMM"),
    previousMonthLabel: format(subMonths(new Date(), 1), "MMM"),
  };
}

function buildDateWindows(now: Date) {
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    monthKeys.push(monthKey(subMonths(now, i)));
  }
  return {
    monthKeys,
    sixMonthsAgo: startOfMonth(subMonths(now, 5)),
    ninetyDaysAgo: subDays(now, 90),
    thirtyDaysAgo: subDays(now, 30),
    sevenDaysAgo: subDays(now, 7),
    currentMonthStart: startOfMonth(now),
    currentMonthEnd: endOfMonth(now),
    prevMonthStart: startOfMonth(subMonths(now, 1)),
    prevMonthEnd: endOfMonth(subMonths(now, 1)),
  };
}

function computeNetTotals(
  plaidAccounts: { type: string; currentBalance: Prisma.Decimal | null }[]
) {
  const totalAssets = plaidAccounts
    .filter((a) => numberValue(a.currentBalance) > 0 && !isLiabilityType(a.type))
    .reduce((s, a) => s + numberValue(a.currentBalance), 0);
  const totalLiabilities = plaidAccounts
    .filter((a) => isLiabilityType(a.type) || numberValue(a.currentBalance) < 0)
    .reduce((s, a) => s + Math.abs(numberValue(a.currentBalance)), 0);
  return { totalAssets, totalLiabilities, currentBalance: totalAssets - totalLiabilities };
}

function buildInsights(input: {
  now: Date;
  monthlySpend: number;
  monthlyIncome: number;
  monthExpenseCount: number;
  subscriptionMerchants: Map<string, number>;
}) {
  const dayOfMonth = input.now.getDate();
  const daysInMonth = endOfMonth(input.now).getDate();
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const subscriptionsTotal = [...input.subscriptionMerchants.values()].reduce((s, v) => s + v, 0);
  return {
    avgDailySpend: dayOfMonth ? input.monthlySpend / dayOfMonth : 0,
    subscriptionsTotal,
    subscriptionsCount: input.subscriptionMerchants.size,
    savingsRate:
      input.monthlyIncome > 0
        ? ((input.monthlyIncome - input.monthlySpend) / input.monthlyIncome) * 100
        : null,
    daysRemaining,
    monthExpenseCount: input.monthExpenseCount,
    daysElapsed: dayOfMonth,
    daysInMonth,
  };
}

export async function getDashboardData(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      plaidAccounts: { orderBy: [{ type: "asc" }, { name: "asc" }] },
      plaidItems: {
        orderBy: { createdAt: "desc" },
        include: { accounts: { orderBy: [{ type: "asc" }, { name: "asc" }] } },
      },
    },
  });

  const investments = await getInvestmentDashboardData(tenant?.id);
  if (!tenant) return emptyDashboardData(tenantSlug, investments);

  const now = new Date();
  const windows = buildDateWindows(now);

  const transactions = await prisma.plaidTransaction.findMany({
    where: { tenantId: tenant.id, removed: false, date: { gte: windows.sixMonthsAgo } },
    orderBy: { date: "desc" },
    include: { account: true },
  });

  const recentTransactions: TransactionSummary[] = transactions.slice(0, 10).map((t) => {
    const cat = t.categoryPrimary ?? "Uncategorized";
    return {
      id: t.id,
      name: t.merchantName ?? t.name,
      rawName: t.name,
      amount: numberValue(t.amount),
      date: t.date.toISOString(),
      category: cat,
      categoryColor: colorForCategory(cat, Math.abs(hash(cat)) % CATEGORY_COLORS.length),
      account: t.account.name,
      pending: t.pending,
    };
  });

  const agg = aggregateTransactions(transactions, windows);

  const balanceSnapshots = await prisma.balanceSnapshot.findMany({
    where: { tenantId: tenant.id, capturedAt: { gte: windows.sixMonthsAgo } },
    include: { account: true },
    orderBy: { capturedAt: "asc" },
  });

  const balanceByDay = buildBalanceByDay(balanceSnapshots);
  const balanceHistory = buildBalanceHistory(balanceByDay, investments.summary.portfolioCAD);

  const { totalAssets, totalLiabilities, currentBalance } = computeNetTotals(tenant.plaidAccounts);

  const monthlySeries = windows.monthKeys.map((k) => agg.monthlyMap.get(k));
  const incomeSpark = monthlySeries.map((m) => m?.income ?? 0);
  const spendSpark = monthlySeries.map((m) => m?.spending ?? 0);
  const cashflowSpark = monthlySeries.map((m) => (m?.income ?? 0) - (m?.spending ?? 0));
  const balanceSparkSeries = buildBalanceSpark(balanceHistory);

  const balanceDelta = computeBalanceDelta(
    balanceHistory,
    balanceByDay,
    investments.summary.portfolioCAD,
    now
  );

  const categorySpend = buildCategorySpend(agg.categoryMap);
  const categorySpend30d = buildCategorySpend(agg.categoryMap30);
  const categorySpendMTD = buildCategorySpend(agg.categoryMapMTD);
  const categorySpend7d = buildCategorySpend(agg.categoryMap7);
  const merchantSpend = buildMerchantSpend(agg.merchantMap);

  const accounts: AccountSummary[] = tenant.plaidAccounts.map(mapAccountSummary);
  const plaidItems: PlaidItemSummary[] = tenant.plaidItems.map(mapPlaidItemSummary);
  const institutions: InstitutionSummary[] = tenant.plaidItems.map(mapInstitutionSummary);

  const insights = buildInsights({
    now,
    monthlySpend: agg.monthlySpend,
    monthlyIncome: agg.monthlyIncome,
    monthExpenseCount: agg.monthExpenseCount,
    subscriptionMerchants: agg.subscriptionMerchants,
  });

  const cashBalance = currentBalance;
  const investmentBalance = investments.summary.portfolioCAD;
  const unifiedBalance = cashBalance + investmentBalance;

  return {
    tenantSlug,
    hasTenant: true,
    totals: {
      accountCount: tenant.plaidAccounts.length,
      transactionCount: transactions.length,
      currentBalance: unifiedBalance,
      cashBalance,
      investmentBalance,
      totalAssets: totalAssets + investmentBalance,
      totalLiabilities,
      monthlySpend: agg.monthlySpend,
      monthlyIncome: agg.monthlyIncome,
      netCashflow: agg.monthlyIncome - agg.monthlySpend,
    },
    deltas: {
      balance: balanceDelta,
      income: delta(agg.monthlyIncome, agg.prevMonthIncome),
      spend: delta(agg.monthlySpend, agg.prevMonthSpend),
      cashflow: delta(
        agg.monthlyIncome - agg.monthlySpend,
        agg.prevMonthIncome - agg.prevMonthSpend
      ),
    },
    sparks: {
      balance: balanceSparkSeries,
      income: incomeSpark,
      spend: spendSpark,
      cashflow: cashflowSpark,
    },
    insights: {
      ...insights,
      largestExpense: agg.largestExpense
        ? {
            name: agg.largestExpense.name,
            amount: agg.largestExpense.amount,
            date: agg.largestExpense.date,
          }
        : null,
    },
    institutions,
    accounts,
    plaidItems,
    recentTransactions,
    monthlyCashflow: [...agg.monthlyMap.values()],
    categorySpend,
    categorySpend30d,
    categorySpendMTD,
    categorySpend7d,
    merchantSpend,
    balanceHistory,
    investments,
    currentMonthLabel: format(now, "MMM"),
    previousMonthLabel: format(subMonths(now, 1), "MMM"),
  };
}

export async function getTransactionsForTenant(input: {
  tenantSlug: string;
  q?: string;
  from?: string;
  to?: string;
  category?: string;
  account?: string;
  bucket?: string;
  pending?: string;
  amountMin?: string;
  amountMax?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (!tenant) return { rows: [], total: 0 };

  const where: Prisma.PlaidTransactionWhereInput = {
    tenantId: tenant.id,
    removed: false,
  };

  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" } },
      { merchantName: { contains: input.q, mode: "insensitive" } },
      { categoryPrimary: { contains: input.q, mode: "insensitive" } },
    ];
  }

  if (input.from || input.to) {
    where.date = {
      gte: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
      lte: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
    };
  }

  if (input.category) where.categoryPrimary = input.category;

  if (input.account) where.account = { is: { name: input.account } };

  if (input.pending === "true") where.pending = true;
  if (input.pending === "false") where.pending = false;

  const [transactions, total] = await Promise.all([
    prisma.plaidTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: { account: true },
      take: 500,
    }),
    prisma.plaidTransaction.count({ where }),
  ]);

  const rows = transactions.map((t) => {
    const cat = t.categoryPrimary ?? "Uncategorized";
    return {
      id: t.id,
      name: t.merchantName ?? t.name,
      rawName: t.name,
      account: t.account.name,
      accountId: t.accountId,
      date: t.date.toISOString(),
      authorizedDate: t.authorizedDate?.toISOString(),
      amount: numberValue(t.amount),
      category: cat,
      categoryColor: colorForCategory(cat, Math.abs(hash(cat)) % CATEGORY_COLORS.length),
      detailedCategory: t.categoryDetailed,
      pending: t.pending,
      bucket: categorizeForSpending(t),
    };
  });

  const amountMin = input.amountMin ? parseFloat(input.amountMin) : null;
  const amountMax = input.amountMax ? parseFloat(input.amountMax) : null;

  const filtered = rows.filter((r) => {
    if (input.bucket && r.bucket !== input.bucket) return false;
    const abs = Math.abs(r.amount);
    if (amountMin !== null && !isNaN(amountMin) && abs < amountMin) return false;
    if (amountMax !== null && !isNaN(amountMax) && abs > amountMax) return false;
    return true;
  });

  return { rows: filtered, total };
}
