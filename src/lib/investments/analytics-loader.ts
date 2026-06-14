import {
  getMacroOverview,
  getMarketDataService,
  type MarketEvents,
  type PricePoint,
} from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import { groupOf } from "./activity-types";
import { loadInvestments } from "./loader";
import { loadHistoricalPerformance, type HistoricalPerformance } from "./performance-loader";

// ─── Portfolio analytics (current holdings × market history) ───────────────
// Reconstruction note: the value series prices TODAY'S holdings at historical
// closes with a constant FX rate — it answers "how has what I hold now been
// moving", not time-weighted performance with flows. Labeled as such in UI.

const CHART_DAYS = 380;
const EVENTS_TOP_N = 20; // earnings calendar covers the largest N positions
const CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const idx = next++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

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
  ttmReceivedCad: number;
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
};

function closeMapOf(series: PricePoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of series) m.set(p.date, p.close);
  return m;
}

/** Returns array aligned to `axis`, carrying the last known close forward and
 *  back-filling dates before the first close with the earliest one. */
function alignToAxis(axis: string[], series: PricePoint[]): (number | null)[] {
  if (series.length === 0) return axis.map(() => null);
  const byDate = closeMapOf(series);
  const first = series[0];
  let last: number | null = null;
  return axis.map((d) => {
    const v = byDate.get(d);
    if (v != null) last = v;
    if (last != null) return last;
    // before first observation — backfill so the level doesn't jump
    return d <= first.date ? first.close : null;
  });
}

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
  const fx = investments?.fxUSDtoCAD ?? 1.35;

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
  const [benchSpx, benchTsx, symbolSeries, profiles, fundamentalsList, macro, performance] =
    await Promise.all([
      svc.getTimeSeries("^GSPC", CHART_DAYS).catch(() => [] as PricePoint[]),
      svc.getTimeSeries("^GSPTSE", CHART_DAYS).catch(() => [] as PricePoint[]),
      mapLimit(aggs, CONCURRENCY, (a) => svc.getTimeSeries(a.symbol, CHART_DAYS).catch(() => [])),
      mapLimit(aggs, CONCURRENCY, (a) => svc.getProfile(a.symbol).catch(() => null)),
      mapLimit(aggs, CONCURRENCY, (a) => svc.getFundamentals(a.symbol).catch(() => null)),
      getMacroOverview().catch(() => []),
      loadHistoricalPerformance(tenantId).catch(() => null),
    ]);

  // ── portfolio value series on the S&P axis ──
  const axis = benchSpx.map((p) => p.date);
  const aligned = symbolSeries.map((s) => alignToAxis(axis, s));
  const fxOf = (ccy: string) => (ccy === "USD" ? fx : 1);

  const series: SeriesPoint[] = [];
  const spxMap = closeMapOf(benchSpx);
  const tsxAligned = alignToAxis(axis, benchTsx);
  axis.forEach((date, di) => {
    let value = 0;
    let covered = 0;
    aggs.forEach((a, ai) => {
      const px = aligned[ai][di];
      if (px != null) {
        value += a.units * px * fxOf(a.currency);
        covered += a.mvCad;
      }
    });
    // Skip leading dates where less than half the book has price history.
    if (totalMv > 0 && covered / totalMv < 0.5) return;
    series.push({
      date,
      portfolio: value,
      spx: spxMap.get(date) ?? null,
      tsx: tsxAligned[di],
    });
  });

  // ── risk stats over the full window ──
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

  // ── income: trailing 12M from synced activity + forward estimate ──
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const activity = await prisma.snapTradeActivity.findMany({
    where: { tenantId, tradeDate: { gte: yearAgo } },
    select: { type: true, amount: true, fxRate: true, tradeDate: true },
  });
  let ttm = 0;
  let payments = 0;
  const monthMap = new Map<string, number>();
  for (const a of activity) {
    if (groupOf(a.type) !== "income") continue;
    const amount = a.amount != null ? Number(a.amount) : 0;
    if (amount <= 0) continue;
    const cad = amount * (a.fxRate != null ? Number(a.fxRate) : 1);
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
    ttmReceivedCad: ttm,
    paymentCount: payments,
    forwardEstCad: forwardCoveredMv > 0 ? forwardEst : null,
    forwardCoveragePct: totalMv > 0 ? (forwardCoveredMv / totalMv) * 100 : 0,
    months,
  };

  // ── upcoming corporate calendar across the top of the book ──
  const top = aggs.slice(0, EVENTS_TOP_N);
  const events = await mapLimit(top, CONCURRENCY, (a) =>
    svc.getEvents(a.symbol).catch(() => null as MarketEvents | null)
  );
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
    fxNote: `USD at constant ${fx.toFixed(4)} CAD`,
    series,
    risk,
    sectors,
    income,
    calendar,
    performance,
  };
}
