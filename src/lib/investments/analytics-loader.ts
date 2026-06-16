import { getMacroOverview, getMarketDataService } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import { loadInvestments } from "./loader";
import {
  loadHistoricalPerformance,
  type HistoricalCoverageIssue,
  type HistoricalPerformance,
} from "./performance-loader";

// ─── Portfolio analytics ────────────────────────────────────────────────────

const EVENTS_TOP_N = 20; // earnings calendar covers the largest N positions
export type SeriesPoint = {
  date: string;
  portfolio: number;
  spx: number | null;
  tsx: number | null;
};

export type RiskStats = {
  windowDays: number;
  annVolPct: number | null;
  beta: number | null; // vs S&P 500, daily returns
  sharpe: number | null; // (ann. return − 3M T-bill) / ann. vol
  maxDrawdownPct: number | null;
  bestDay: { date: string; pct: number } | null;
  worstDay: { date: string; pct: number } | null;
  top5WeightPct: number;
  effectiveN: number | null; // 1 / Σ w²
  holdingsCount: number;
};

export type SectorSlice = { name: string; mvCad: number; weightPct: number };

export type IncomeMonth = { month: string; amountCad: number }; // YYYY-MM

export type IncomeStats = {
  ttmGrossIncomeCad: number;
  withholdingTaxCad: number;
  paymentCount: number;
  forwardEstCad: number | null; // Σ yield% × mvCAD where known
  forwardCoveragePct: number; // share of MV with a known yield
  months: IncomeMonth[]; // last 12 months
};

export type CalendarEntry = {
  symbol: string;
  name: string;
  kind: "earnings" | "ex-dividend" | "dividend-pay";
  date: string; // ISO
};

export type PortfolioAnalytics = {
  hasHoldings: boolean;
  asOf: string;
  fxNote: string;
  series: SeriesPoint[];
  risk: RiskStats | null;
  sectors: SectorSlice[];
  income: IncomeStats | null;
  calendar: CalendarEntry[];
  performance: HistoricalPerformance | null;
  mwrPct: number | null;
  coverageIssues: HistoricalCoverageIssue[];
};

const EMPTY: PortfolioAnalytics = {
  hasHoldings: false,
  asOf: new Date(0).toISOString(),
  fxNote: "",
  series: [],
  risk: null,
  sectors: [],
  income: null,
  calendar: [],
  performance: null,
  mwrPct: null,
  coverageIssues: [],
};

function dailyReturns(values: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) rets.push(values[i] / values[i - 1] - 1);
  }
  return rets;
}

function stdev(xs: number[]): number | null {
  if (xs.length < 20) return null;
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export async function getPortfolioAnalytics(
  tenantId: string | null | undefined
): Promise<PortfolioAnalytics> {
  if (!tenantId) return EMPTY;
  const investments = await loadInvestments(tenantId).catch(() => null);
  const holdings = investments?.holdings ?? [];
  if (holdings.length === 0) return EMPTY;

  const svc = getMarketDataService();

  // ── aggregate per symbol ──
  type Agg = {
    symbol: string;
    name: string;
    type: string;
    units: number;
    currency: string;
    mvCad: number;
  };
  const bySymbol = new Map<string, Agg>();
  for (const h of holdings) {
    const cur = bySymbol.get(h.symbol);
    if (cur) {
      cur.units += h.units;
      cur.mvCad += h.mvCAD;
    } else {
      bySymbol.set(h.symbol, {
        symbol: h.symbol,
        name: h.description,
        type: h.type,
        units: h.units,
        currency: h.currency.toUpperCase(),
        mvCad: h.mvCAD,
      });
    }
  }
  const aggs = [...bySymbol.values()].sort((a, b) => b.mvCad - a.mvCad);
  const totalMv = aggs.reduce((s, a) => s + a.mvCad, 0);

  // ── market data (bounded concurrency; everything lands in the DB cache) ──
  const symbols = aggs.map((a) => a.symbol);
  const [profiles, fundamentalsList, macro, performance] = await Promise.all([
    svc.getProfiles(symbols).catch(() => symbols.map(() => null)),
    svc.getFundamentalsForSymbols(symbols).catch(() => symbols.map(() => null)),
    getMacroOverview().catch(() => []),
    loadHistoricalPerformance(tenantId).catch(() => null),
  ]);

  // ── portfolio series from the flow-aware TWR engine ──
  const series: SeriesPoint[] = performance?.series ?? [];

  // ── risk stats ──
  const values = series.map((p) => p.portfolio);
  const rets = dailyReturns(values);
  const sd = stdev(rets);
  const annVol = sd != null ? sd * Math.sqrt(252) * 100 : null;

  // Beta vs S&P on overlapping daily returns.
  let beta: number | null = null;
  const spxVals = series.map((p) => p.spx).filter((v): v is number => v != null);
  if (spxVals.length === series.length && rets.length >= 20) {
    const spxRets = dailyReturns(spxVals);
    const n = Math.min(rets.length, spxRets.length);
    const a = rets.slice(-n);
    const b = spxRets.slice(-n);
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = b.reduce((s, v) => s + v, 0) / n;
    let cov = 0;
    let varB = 0;
    for (let i = 0; i < n; i++) {
      cov += (a[i] - ma) * (b[i] - mb);
      varB += (b[i] - mb) ** 2;
    }
    beta = varB > 0 ? cov / varB : null;
  }

  // Sharpe: annualized window return minus 3M T-bill, over annualized vol.
  let sharpe: number | null = null;
  const rf = macro.find((m) => m.id === "UST3M")?.value ?? null;
  if (values.length > 40 && annVol != null && annVol > 0) {
    const windowYears = values.length / 252;
    const totalRet = values.at(-1)! / values[0] - 1;
    const annRet = (Math.pow(1 + totalRet, 1 / windowYears) - 1) * 100;
    sharpe = (annRet - (rf ?? 0)) / annVol;
  }

  // Max drawdown + best/worst day.
  let peak = -Infinity;
  let maxDd = 0;
  values.forEach((v) => {
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.min(maxDd, v / peak - 1);
  });
  let bestDay: RiskStats["bestDay"] = null;
  let worstDay: RiskStats["worstDay"] = null;
  rets.forEach((r, i) => {
    const date = series[i + 1]?.date ?? "";
    if (!bestDay || r > bestDay.pct / 100) bestDay = { date, pct: r * 100 };
    if (!worstDay || r < worstDay.pct / 100) worstDay = { date, pct: r * 100 };
  });

  // Concentration.
  const weights = aggs.map((a) => (totalMv > 0 ? a.mvCad / totalMv : 0));
  const top5 = weights.slice(0, 5).reduce((s, w) => s + w, 0) * 100;
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const effectiveN = hhi > 0 ? 1 / hhi : null;

  const risk: RiskStats = {
    windowDays: series.length,
    annVolPct: annVol,
    beta,
    sharpe,
    maxDrawdownPct: maxDd * 100,
    bestDay,
    worstDay,
    top5WeightPct: top5,
    effectiveN,
    holdingsCount: aggs.length,
  };

  // ── sector exposure (funds bucketed separately) ──
  const FUND_TYPES = new Set(["ETF", "MUTUAL FUND", "CEF", "FUND"]);
  const sectorMv = new Map<string, number>();
  aggs.forEach((a, i) => {
    const sector =
      profiles[i]?.sector ??
      (FUND_TYPES.has(a.type.toUpperCase()) || fundamentalsList[i]?.aum != null
        ? "Funds & ETFs"
        : "Unclassified");
    sectorMv.set(sector, (sectorMv.get(sector) ?? 0) + a.mvCad);
  });
  const sectors: SectorSlice[] = [...sectorMv.entries()]
    .map(([name, mvCad]) => ({
      name,
      mvCad,
      weightPct: totalMv > 0 ? (mvCad / totalMv) * 100 : 0,
    }))
    .sort((a, b) => b.mvCad - a.mvCad);

  // ── income: trailing 12M from the canonical ledger + forward estimate ──
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const activity = await prisma.brokerLedgerEntry.findMany({
    where: {
      tenantId,
      tradeDate: { gte: yearAgo },
      account: { is: { tracked: true } },
      OR: [
        { activityType: "Dividend" },
        { activityType: "Interest" },
        { activityType: "Fee", activitySubType: "TAX" },
      ],
    },
    select: {
      activityType: true,
      activitySubType: true,
      cashAmount: true,
      tradeDate: true,
    },
  });
  let ttm = 0;
  let withholdingTax = 0;
  let payments = 0;
  const monthMap = new Map<string, number>();
  for (const a of activity) {
    if (a.activityType === "Fee" && a.activitySubType === "TAX") {
      withholdingTax += a.cashAmount?.isPositive() ? a.cashAmount.toNumber() : 0;
      continue;
    }
    const cad = a.cashAmount?.isNegative() ? a.cashAmount.negated().toNumber() : 0;
    if (cad <= 0) continue;
    ttm += cad;
    payments += 1;
    const month = a.tradeDate?.toISOString().slice(0, 7);
    if (month) monthMap.set(month, (monthMap.get(month) ?? 0) + cad);
  }
  const months: IncomeMonth[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({ month: key, amountCad: monthMap.get(key) ?? 0 });
  }

  let forwardEst = 0;
  let forwardCoveredMv = 0;
  aggs.forEach((a, i) => {
    const y = fundamentalsList[i]?.dividendYieldPct;
    if (y != null && y >= 0) {
      forwardEst += (y / 100) * a.mvCad;
      forwardCoveredMv += a.mvCad;
    }
  });

  const income: IncomeStats = {
    ttmGrossIncomeCad: ttm,
    withholdingTaxCad: withholdingTax,
    paymentCount: payments,
    forwardEstCad: forwardCoveredMv > 0 ? forwardEst : null,
    forwardCoveragePct: totalMv > 0 ? (forwardCoveredMv / totalMv) * 100 : 0,
    months,
  };

  // ── upcoming corporate calendar across the top of the book ──
  const top = aggs.slice(0, EVENTS_TOP_N);
  const events = await svc
    .getEventsForSymbols(top.map((a) => a.symbol))
    .catch(() => top.map(() => null));
  const horizon = Date.now() + 60 * 24 * 60 * 60 * 1000;
  const calendar: CalendarEntry[] = [];
  top.forEach((a, i) => {
    const e = events[i];
    if (!e) return;
    const push = (kind: CalendarEntry["kind"], iso: string | null) => {
      if (!iso) return;
      const t = Date.parse(iso);
      if (!Number.isFinite(t) || t < Date.now() - 24 * 60 * 60 * 1000 || t > horizon) return;
      calendar.push({ symbol: a.symbol, name: a.name, kind, date: iso });
    };
    push("earnings", e.nextEarnings);
    push("ex-dividend", e.exDividend);
    push("dividend-pay", e.dividendDate);
  });
  calendar.sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasHoldings: true,
    asOf: new Date().toISOString(),
    fxNote: performance?.fxSource ?? "Bank of Canada USD/CAD",
    series,
    risk,
    sectors,
    income,
    calendar,
    performance,
    mwrPct: performance?.mwr != null ? performance.mwr * 100 : null,
    coverageIssues: performance?.coverageIssues ?? [],
  };
}
