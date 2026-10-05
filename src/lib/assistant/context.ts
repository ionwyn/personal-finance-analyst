import { format } from "date-fns";

import { getDashboardData } from "@/lib/analytics";
import { formatCategoryName } from "@/lib/spending/category";
import { getSpendingInsight } from "@/lib/spending/getSpendingInsight";

// ─── Financial facts block ─────────────────────────────────────────────────
// The assistant model NEVER sees raw transactions or does arithmetic. Instead it
// receives this compact, server-computed snapshot and answers only from it. Every
// derived figure (YTD totals, annualised run-rates) is calculated here, in
// TypeScript, so the model only has to read numbers — never compute them.

const CURRENCY = "CAD";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fraction of the calendar year elapsed, used to annualise YTD figures. */
function yearFraction(now: Date): number {
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  return (now.getTime() - start) / (end - start);
}

export type FinancialFacts = {
  asOf: string;
  currency: string;
  balances: {
    total: number;
    cash: number;
    investments: number;
    liabilities: number;
  };
  thisMonth: {
    label: string;
    income: number;
    spend: number;
    net: number;
    savingsRatePct: number | null;
    largestExpense: { name: string; amount: number; date: string } | null;
    subscriptionsTotal: number;
    subscriptionsCount: number;
  };
  yearToDate: {
    income: number;
    spend: number;
    net: number;
    // Straight-line projection of the YTD pace onto a full year. Not a forecast.
    annualizedIncome: number;
    annualizedSpend: number;
    annualizedNet: number;
  };
  topCategoriesThisMonth: { category: string; amount: number }[];
  topCategories30d: { category: string; amount: number }[];
  topMerchants90d: { merchant: string; amount: number }[];
  monthlyCashflow: { month: string; income: number; spend: number; net: number }[];
  avgMonthly: { income: number; spend: number };
  investments: {
    portfolioValue: number;
    unrealizedPL: number;
    unrealizedPLPct: number;
    topHoldings: { symbol: string; value: number; plPct: number | null }[];
    // Pre-computed extremes by P&L %, so "biggest winner/loser" never relies on
    // the model scanning a list (which it does unreliably).
    biggestGainer: { symbol: string; plPct: number; value: number } | null;
    biggestLoser: { symbol: string; plPct: number; value: number } | null;
  };
};

export async function buildFinancialFacts(input: {
  tenantId: string;
  tenantSlug: string;
}): Promise<FinancialFacts> {
  const now = new Date();
  const [dash, ytd] = await Promise.all([
    getDashboardData(input.tenantSlug),
    getSpendingInsight(input.tenantId, "YTD"),
  ]);

  const fraction = yearFraction(now) || 1;
  const ytdNet = ytd.totalIncome - ytd.totalSpending;

  const cashflow = dash.monthlyCashflow ?? [];
  const monthCount = cashflow.length || 1;
  const avgIncome = cashflow.reduce((s, m) => s + m.income, 0) / monthCount;
  const avgSpend = cashflow.reduce((s, m) => s + m.spending, 0) / monthCount;

  const holdings = dash.investments?.holdings ?? [];
  const topHoldings = [...holdings]
    .sort((a, b) => b.mvCAD - a.mvCAD)
    .slice(0, 8)
    .map((h) => ({ symbol: h.symbol, value: round(h.mvCAD), plPct: h.plPct }));

  // Extremes computed over ALL holdings (not just the top by value) so a big
  // winner that's a small position still surfaces.
  const byPlPct = holdings
    .filter((h): h is typeof h & { plPct: number } => h.plPct != null)
    .sort((a, b) => b.plPct - a.plPct);
  const extreme = (h: (typeof byPlPct)[number] | undefined) =>
    h ? { symbol: h.symbol, plPct: round(h.plPct), value: round(h.mvCAD) } : null;
  const biggestGainer = extreme(byPlPct[0]);
  const biggestLoser = extreme(byPlPct[byPlPct.length - 1]);

  return {
    asOf: format(now, "yyyy-MM-dd"),
    currency: CURRENCY,
    balances: {
      total: round(dash.totals.currentBalance),
      cash: round(dash.totals.cashBalance),
      investments: round(dash.totals.investmentBalance),
      liabilities: round(dash.totals.totalLiabilities),
    },
    thisMonth: {
      label: dash.currentMonthLabel,
      income: round(dash.totals.monthlyIncome),
      spend: round(dash.totals.monthlySpend),
      net: round(dash.totals.netCashflow),
      savingsRatePct: dash.insights.savingsRate == null ? null : round(dash.insights.savingsRate),
      largestExpense: dash.insights.largestExpense
        ? {
            name: dash.insights.largestExpense.name,
            amount: round(dash.insights.largestExpense.amount),
            date: dash.insights.largestExpense.date.slice(0, 10),
          }
        : null,
      subscriptionsTotal: round(dash.insights.subscriptionsTotal),
      subscriptionsCount: dash.insights.subscriptionsCount,
    },
    yearToDate: {
      income: round(ytd.totalIncome),
      spend: round(ytd.totalSpending),
      net: round(ytdNet),
      annualizedIncome: round(ytd.totalIncome / fraction),
      annualizedSpend: round(ytd.totalSpending / fraction),
      annualizedNet: round(ytdNet / fraction),
    },
    topCategoriesThisMonth: dash.categorySpendMTD.slice(0, 6).map((c) => ({
      category: formatCategoryName(c.category),
      amount: round(c.amount),
    })),
    topCategories30d: dash.categorySpend30d.slice(0, 5).map((c) => ({
      category: formatCategoryName(c.category),
      amount: round(c.amount),
    })),
    topMerchants90d: dash.merchantSpend.slice(0, 6).map((m) => ({
      merchant: m.merchant,
      amount: round(m.amount),
    })),
    monthlyCashflow: cashflow.map((m) => ({
      month: m.month,
      income: round(m.income),
      spend: round(m.spending),
      net: round(m.net),
    })),
    avgMonthly: { income: round(avgIncome), spend: round(avgSpend) },
    investments: {
      portfolioValue: round(dash.investments?.summary.portfolioCAD ?? 0),
      unrealizedPL: round(dash.investments?.summary.plCAD ?? 0),
      unrealizedPLPct: round(dash.investments?.summary.plPct ?? 0),
      topHoldings,
      biggestGainer,
      biggestLoser,
    },
  };
}

/**
 * Serialise the facts into a compact, token-frugal block for the model prompt.
 * Plain labelled lines read more reliably to a small model than nested JSON.
 */
export function serializeFacts(f: FinancialFacts): string {
  const money = (n: number) => `${f.currency} ${n.toLocaleString("en-CA")}`;
  const lines: string[] = [];

  lines.push(`AS OF: ${f.asOf} (all amounts in ${f.currency})`);
  lines.push(
    "SIGN CONVENTION: spend figures are positive expenses; income figures are positive amounts received."
  );
  lines.push("");
  lines.push("NET WORTH:");
  lines.push(`- Total balance: ${money(f.balances.total)}`);
  lines.push(`- Cash: ${money(f.balances.cash)}`);
  lines.push(`- Investments: ${money(f.balances.investments)}`);
  lines.push(`- Liabilities: ${money(f.balances.liabilities)}`);
  lines.push("");
  lines.push(`THIS MONTH (${f.thisMonth.label}):`);
  lines.push(`- Income: ${money(f.thisMonth.income)}`);
  lines.push(`- Spend: ${money(f.thisMonth.spend)}`);
  lines.push(`- Net: ${money(f.thisMonth.net)}`);
  lines.push(
    `- Savings rate: ${f.thisMonth.savingsRatePct == null ? "n/a" : `${f.thisMonth.savingsRatePct}%`}`
  );
  if (f.thisMonth.largestExpense) {
    lines.push(
      `- Largest expense: ${f.thisMonth.largestExpense.name} ${money(f.thisMonth.largestExpense.amount)} on ${f.thisMonth.largestExpense.date}`
    );
  }
  lines.push(
    `- Subscriptions: ${f.thisMonth.subscriptionsCount} totalling ${money(f.thisMonth.subscriptionsTotal)}`
  );
  lines.push("");
  lines.push("YEAR TO DATE:");
  lines.push(`- Income: ${money(f.yearToDate.income)}`);
  lines.push(`- Spend: ${money(f.yearToDate.spend)}`);
  lines.push(`- Net: ${money(f.yearToDate.net)}`);
  lines.push(
    `- Annualised pace (straight-line projection, not a forecast): income ${money(f.yearToDate.annualizedIncome)}, spend ${money(f.yearToDate.annualizedSpend)}, net ${money(f.yearToDate.annualizedNet)}`
  );
  lines.push(
    `- Average per month (last ${f.monthlyCashflow.length} mo): income ${money(f.avgMonthly.income)}, spend ${money(f.avgMonthly.spend)}`
  );
  lines.push("");
  lines.push("TOP SPENDING CATEGORIES THIS MONTH:");
  if (f.topCategoriesThisMonth.length === 0) lines.push("- (none yet this month)");
  for (const c of f.topCategoriesThisMonth) lines.push(`- ${c.category}: ${money(c.amount)}`);
  lines.push("");
  lines.push("TOP CATEGORIES (last 30 days):");
  for (const c of f.topCategories30d) lines.push(`- ${c.category}: ${money(c.amount)}`);
  lines.push("");
  lines.push("TOP MERCHANTS (last 90 days):");
  for (const m of f.topMerchants90d) lines.push(`- ${m.merchant}: ${money(m.amount)}`);
  lines.push("");
  lines.push("MONTHLY CASHFLOW (oldest → newest):");
  for (const m of f.monthlyCashflow) {
    lines.push(
      `- ${m.month}: income ${money(m.income)}, spend ${money(m.spend)}, net ${money(m.net)}`
    );
  }
  lines.push("");
  lines.push("INVESTMENTS:");
  lines.push(`- Portfolio value: ${money(f.investments.portfolioValue)}`);
  lines.push(
    `- Unrealised P&L: ${money(f.investments.unrealizedPL)} (${f.investments.unrealizedPLPct}%) — a point-in-time figure, NOT a monthly or periodic return`
  );
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${round(n)}%`;
  if (f.investments.biggestGainer) {
    const g = f.investments.biggestGainer;
    lines.push(
      `- Biggest winner by return: ${g.symbol} at ${pct(g.plPct)} (value ${money(g.value)})`
    );
  }
  if (f.investments.biggestLoser && f.investments.biggestLoser.plPct < 0) {
    const l = f.investments.biggestLoser;
    lines.push(
      `- Biggest loser by return: ${l.symbol} at ${pct(l.plPct)} (value ${money(l.value)})`
    );
  }
  if (f.investments.topHoldings.length > 0) {
    lines.push(
      "- Top holdings by value (return % is each holding's own gain/loss, NOT its share of the portfolio):"
    );
    for (const h of f.investments.topHoldings) {
      lines.push(
        `  - ${h.symbol}: ${money(h.value)}${h.plPct == null ? "" : `, return ${pct(h.plPct)}`}`
      );
    }
  }

  return lines.join("\n");
}

export async function buildFinancialContext(input: {
  tenantId: string;
  tenantSlug: string;
}): Promise<{ facts: FinancialFacts; block: string }> {
  const facts = await buildFinancialFacts(input);
  return { facts, block: serializeFacts(facts) };
}
