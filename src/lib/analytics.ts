import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import type { InvestmentDashboardData } from "@/lib/investments/types";
import { categorizeForSpending } from "@/lib/spending/classify";

const CATEGORY_COLORS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)"
];

function numberValue(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function monthKey(date: Date) {
  return format(startOfMonth(date), "yyyy-MM");
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM");
}

function delta(curr: number, prev: number) {
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

const SUBSCRIPTION_HINTS = [
  "netflix",
  "spotify",
  "hulu",
  "apple",
  "amazon prime",
  "disney",
  "youtube",
  "patreon",
  "github",
  "openai",
  "claude",
  "vercel",
  "figma",
  "notion",
  "1password",
  "dropbox",
  "icloud",
  "adobe",
  "ms365",
  "office 365",
  "linkedin",
  "twitter",
  "x premium",
  "equinox",
  "peloton",
  "audible",
  "kindle",
  "new york times",
  "wsj"
];

function isLikelySubscription(name: string, category: string | null) {
  const lower = name.toLowerCase();
  if (SUBSCRIPTION_HINTS.some((s) => lower.includes(s))) return true;
  if (category && /subscription/i.test(category)) return true;
  return false;
}

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
      netCashflow: 0
    },
    deltas: {
      balance: null as number | null,
      income: null as number | null,
      spend: null as number | null,
      cashflow: null as number | null
    },
    sparks: {
      balance: [] as number[],
      income: [] as number[],
      spend: [] as number[],
      cashflow: [] as number[]
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
      daysInMonth: 30
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
    previousMonthLabel: format(subMonths(new Date(), 1), "MMM")
  };
}

export type AccountSummary = {
  id: string;
  itemId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  availableBalance: number;
  currentBalance: number;
  isoCurrencyCode: string;
  lastBalanceAt: string | null;
};

export type PlaidItemSummary = {
  id: string;
  institutionName: string;
  institutionId: string | null;
  status: string;
  lastSyncAt: string | null;
  lastBalanceRefreshAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type InstitutionSummary = PlaidItemSummary & {
  total: number;
  accounts: AccountSummary[];
};

export type TransactionSummary = {
  id: string;
  name: string;
  rawName: string;
  amount: number;
  date: string;
  category: string;
  categoryColor: string;
  account: string;
  pending: boolean;
};

export type MonthlyCashflow = { month: string; income: number; spending: number; net: number };
export type CategorySpend = { category: string; amount: number; pct: number; color: string };
export type MerchantSpend = { merchant: string; amount: number };
export type BalancePoint = { date: string; balance: number };

function colorForCategory(category: string, index: number) {
  if (category === "Income" || /income/i.test(category)) return "var(--pos)";
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export async function getDashboardData(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      plaidAccounts: {
        orderBy: [{ type: "asc" }, { name: "asc" }]
      },
      plaidItems: {
        orderBy: { createdAt: "desc" },
        include: {
          accounts: {
            orderBy: [{ type: "asc" }, { name: "asc" }]
          }
        }
      }
    }
  });

  const investments = await getInvestmentDashboardData(tenant?.id);
  if (!tenant) return emptyDashboardData(tenantSlug, investments);

  const now = new Date();
  const sixMonthsAgo = startOfMonth(subMonths(now, 5));
  const ninetyDaysAgo = subDays(now, 90);
  const thirtyDaysAgo = subDays(now, 30);
  const sevenDaysAgo = subDays(now, 7);
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const transactions = await prisma.plaidTransaction.findMany({
    where: {
      tenantId: tenant.id,
      removed: false,
      date: { gte: sixMonthsAgo }
    },
    orderBy: { date: "desc" },
    include: { account: true }
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
      pending: t.pending
    };
  });

  // Monthly cashflow buckets (6 months)
  const monthlyMap = new Map<string, MonthlyCashflow>();
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = subMonths(now, i);
    const key = monthKey(date);
    monthKeys.push(key);
    monthlyMap.set(key, { month: monthLabel(key), income: 0, spending: 0, net: 0 });
  }

  const categoryMap = new Map<string, number>();
  const categoryMap30 = new Map<string, number>();
  const categoryMapMTD = new Map<string, number>();
  const categoryMap7 = new Map<string, number>();
  const merchantMap = new Map<string, number>();
  let monthlySpend = 0;
  let monthlyIncome = 0;
  let prevMonthSpend = 0;
  let prevMonthIncome = 0;
  let largestExpense: TransactionSummary | null = null;
  let monthExpenseCount = 0;
  const subscriptionMerchants = new Map<string, number>();

  for (const t of transactions) {
    const amount = numberValue(t.amount);
    const bucket = categorizeForSpending(t);
    const isSpending = bucket === "spending";
    const isIncome = bucket === "income";
    const spendValue = isSpending ? amount : 0;
    const incomeValue = isIncome ? Math.abs(amount) : 0;

    const cashflow = monthlyMap.get(monthKey(t.date));
    if (cashflow) {
      cashflow.income += incomeValue;
      cashflow.spending += spendValue;
      cashflow.net = cashflow.income - cashflow.spending;
    }

    if (t.date >= currentMonthStart && t.date <= currentMonthEnd) {
      if (isSpending) {
        monthlySpend += amount;
        monthExpenseCount += 1;
        if (!largestExpense || amount > largestExpense.amount) {
          largestExpense = {
            id: t.id,
            name: t.merchantName ?? t.name,
            rawName: t.name,
            amount,
            date: t.date.toISOString(),
            category: t.categoryPrimary ?? "Uncategorized",
            categoryColor: "var(--cat-1)",
            account: t.account.name,
            pending: t.pending
          };
        }

        if (isLikelySubscription(t.merchantName ?? t.name, t.categoryPrimary)) {
          const key = (t.merchantName ?? t.name).toLowerCase();
          subscriptionMerchants.set(key, (subscriptionMerchants.get(key) ?? 0) + amount);
        }
      }
      if (isIncome) monthlyIncome += incomeValue;
    }

    if (t.date >= prevMonthStart && t.date <= prevMonthEnd) {
      if (isSpending) prevMonthSpend += amount;
      if (isIncome) prevMonthIncome += incomeValue;
    }

    if (isSpending) {
      const category = t.categoryPrimary ?? "Uncategorized";
      const merchant = t.merchantName ?? t.name;
      if (t.date >= ninetyDaysAgo) {
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
        merchantMap.set(merchant, (merchantMap.get(merchant) ?? 0) + amount);
      }
      if (t.date >= thirtyDaysAgo) {
        categoryMap30.set(category, (categoryMap30.get(category) ?? 0) + amount);
      }
      if (t.date >= currentMonthStart) {
        categoryMapMTD.set(category, (categoryMapMTD.get(category) ?? 0) + amount);
      }
      if (t.date >= sevenDaysAgo) {
        categoryMap7.set(category, (categoryMap7.get(category) ?? 0) + amount);
      }
    }
  }

  const balanceSnapshots = await prisma.balanceSnapshot.findMany({
    where: { tenantId: tenant.id, capturedAt: { gte: sixMonthsAgo } },
    include: { account: true },
    orderBy: { capturedAt: "asc" }
  });

  const balanceByDay = new Map<string, { date: Date; balance: number }>();
  for (const snapshot of balanceSnapshots) {
    const key = format(snapshot.capturedAt, "MMM d");
    const acctType = snapshot.account.type.toLowerCase();
    const isLiability = acctType.includes("credit") || acctType.includes("loan");
    const value = numberValue(snapshot.currentBalance);
    const signed = isLiability ? -Math.abs(value) : value;
    const existing = balanceByDay.get(key);
    balanceByDay.set(key, {
      date: existing?.date ?? snapshot.capturedAt,
      balance: (existing?.balance ?? 0) + signed
    });
  }
  const balanceHistory: BalancePoint[] = [...balanceByDay.entries()].map(([date, info]) => ({
    date,
    balance: info.balance
  }));

  const totalAssets = tenant.plaidAccounts
    .filter((a) => numberValue(a.currentBalance) > 0 && !isLiabilityType(a.type))
    .reduce((s, a) => s + numberValue(a.currentBalance), 0);
  const totalLiabilities = tenant.plaidAccounts
    .filter((a) => isLiabilityType(a.type) || numberValue(a.currentBalance) < 0)
    .reduce((s, a) => s + Math.abs(numberValue(a.currentBalance)), 0);
  const currentBalance = totalAssets - totalLiabilities;

  // Sparkline series
  const monthlySeries = monthKeys.map((k) => monthlyMap.get(k));
  const incomeSpark = monthlySeries.map((m) => m?.income ?? 0);
  const spendSpark = monthlySeries.map((m) => m?.spending ?? 0);
  const cashflowSpark = monthlySeries.map((m) => (m?.income ?? 0) - (m?.spending ?? 0));

  const balanceSparkSeries = (() => {
    if (balanceHistory.length <= 32) return balanceHistory.map((p) => p.balance);
    const stride = Math.ceil(balanceHistory.length / 32);
    return balanceHistory.filter((_, i) => i % stride === 0).map((p) => p.balance);
  })();

  // Deltas (vs last month)
  const balanceDelta = (() => {
    if (balanceHistory.length < 2) return null;
    const entries = [...balanceByDay.values()];
    const last = entries[entries.length - 1].balance;
    const cutoff = subDays(now, 30);
    const prior = entries.find((e) => e.date <= cutoff);
    if (!prior) return null;
    return delta(last, prior.balance);
  })();

  function buildCategorySpend(map: Map<string, number>): CategorySpend[] {
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((c, i) => ({
        ...c,
        pct: total ? (c.amount / total) * 100 : 0,
        color: colorForCategory(c.category, i)
      }));
  }

  const categorySpend = buildCategorySpend(categoryMap);
  const categorySpend30d = buildCategorySpend(categoryMap30);
  const categorySpendMTD = buildCategorySpend(categoryMapMTD);
  const categorySpend7d = buildCategorySpend(categoryMap7);

  const merchantSpend: MerchantSpend[] = [...merchantMap.entries()]
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const accounts: AccountSummary[] = tenant.plaidAccounts.map((a) => ({
    id: a.id,
    itemId: a.itemId,
    name: a.name,
    officialName: a.officialName,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    availableBalance: numberValue(a.availableBalance),
    currentBalance: numberValue(a.currentBalance),
    isoCurrencyCode: a.isoCurrencyCode ?? "USD",
    lastBalanceAt: a.lastBalanceAt?.toISOString() ?? null
  }));

  const plaidItems: PlaidItemSummary[] = tenant.plaidItems.map((item) => ({
    id: item.id,
    institutionName: item.institutionName ?? item.institutionId ?? "Linked institution",
    institutionId: item.institutionId,
    status: item.status,
    lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
    lastBalanceRefreshAt: item.lastBalanceRefreshAt?.toISOString() ?? null,
    errorCode: item.errorCode,
    errorMessage: item.errorMessage
  }));

  const institutions: InstitutionSummary[] = tenant.plaidItems.map((item) => {
    const itemAccounts: AccountSummary[] = item.accounts.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      name: a.name,
      officialName: a.officialName,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
      availableBalance: numberValue(a.availableBalance),
      currentBalance: numberValue(a.currentBalance),
      isoCurrencyCode: a.isoCurrencyCode ?? "USD",
      lastBalanceAt: a.lastBalanceAt?.toISOString() ?? null
    }));
    const total = itemAccounts.reduce((s, a) => {
      const sign = isLiabilityType(a.type) ? -1 : 1;
      return s + sign * Math.abs(a.currentBalance);
    }, 0);
    return {
      id: item.id,
      institutionName: item.institutionName ?? item.institutionId ?? "Linked institution",
      institutionId: item.institutionId,
      status: item.status,
      lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
      lastBalanceRefreshAt: item.lastBalanceRefreshAt?.toISOString() ?? null,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      total,
      accounts: itemAccounts
    };
  });

  // Insights
  const dayOfMonth = now.getDate();
  const daysInMonth = endOfMonth(now).getDate();
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);
  const avgDailySpend = dayOfMonth ? monthlySpend / dayOfMonth : 0;
  const subscriptionsTotal = [...subscriptionMerchants.values()].reduce((s, v) => s + v, 0);
  const subscriptionsCount = subscriptionMerchants.size;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpend) / monthlyIncome) * 100 : null;

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
      monthlySpend,
      monthlyIncome,
      netCashflow: monthlyIncome - monthlySpend
    },
    deltas: {
      balance: balanceDelta,
      income: delta(monthlyIncome, prevMonthIncome),
      spend: delta(monthlySpend, prevMonthSpend),
      cashflow: delta(monthlyIncome - monthlySpend, prevMonthIncome - prevMonthSpend)
    },
    sparks: {
      balance: balanceSparkSeries,
      income: incomeSpark,
      spend: spendSpark,
      cashflow: cashflowSpark
    },
    insights: {
      avgDailySpend,
      largestExpense: largestExpense
        ? { name: largestExpense.name, amount: largestExpense.amount, date: largestExpense.date }
        : null,
      subscriptionsTotal,
      subscriptionsCount,
      savingsRate,
      daysRemaining,
      monthExpenseCount,
      daysElapsed: dayOfMonth,
      daysInMonth
    },
    institutions,
    accounts,
    plaidItems,
    recentTransactions,
    monthlyCashflow: [...monthlyMap.values()],
    categorySpend,
    categorySpend30d,
    categorySpendMTD,
    categorySpend7d,
    merchantSpend,
    balanceHistory,
    investments,
    currentMonthLabel: format(now, "MMM"),
    previousMonthLabel: format(subMonths(now, 1), "MMM")
  };
}

function isLiabilityType(type: string) {
  const lower = type.toLowerCase();
  return lower.includes("credit") || lower.includes("loan");
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function getTransactionsForTenant(input: {
  tenantSlug: string;
  q?: string;
  from?: string;
  to?: string;
  category?: string;
  account?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (!tenant) return [];

  const where: Prisma.PlaidTransactionWhereInput = {
    tenantId: tenant.id,
    removed: false
  };

  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" } },
      { merchantName: { contains: input.q, mode: "insensitive" } },
      { categoryPrimary: { contains: input.q, mode: "insensitive" } }
    ];
  }

  if (input.from || input.to) {
    where.date = {
      gte: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
      lte: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined
    };
  }

  if (input.category) where.categoryPrimary = input.category;

  if (input.account) where.account = { is: { name: input.account } };

  const transactions = await prisma.plaidTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: { account: true },
    take: 500
  });

  return transactions.map((t) => {
    const cat = t.categoryPrimary ?? "Uncategorized";
    return {
      id: t.id,
      name: t.merchantName ?? t.name,
      rawName: t.name,
      account: t.account.name,
      accountId: t.accountId,
      date: t.date.toISOString(),
      amount: numberValue(t.amount),
      category: cat,
      categoryColor: colorForCategory(cat, Math.abs(hash(cat)) % CATEGORY_COLORS.length),
      detailedCategory: t.categoryDetailed,
      pending: t.pending,
      bucket: categorizeForSpending(t)
    };
  });
}
