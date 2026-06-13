import {
  getEarningsHistory,
  getInsiderTxs,
  getMarketDataService,
  getRecTrends,
  isUsListed,
} from "@/lib/market-data";
import { isOpenMarketInsiderTransaction, openMarketInsiderValue } from "@/lib/market-data/insiders";
import { prisma } from "@/lib/prisma";

import { loadInvestments } from "./loader";

// ─── Desk monitor — the whole book on one intelligence sheet ────────────────
// One row per held symbol (plus watch-only tickers): quote, 52-week range,
// next earnings, last EPS surprise, analyst-rec migration and 90-day insider
// flow. Everything flows through the Postgres caches (quotes 15 min, events
// 24 h, intel per-kind TTLs), so refreshing the tab is cheap; the cold sweep
// is bounded by mapLimit to stay inside Finnhub's 60 req/min.

const QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
const CONCURRENCY = 4;

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

export type MonitorRow = {
  symbol: string;
  name: string | null;
  currency: string | null;
  held: boolean;
  weight: number; // % of holdings MV (0 for watch-only rows)
  mvCad: number;
  price: number | null;
  changePct: number | null;
  rangePos52w: number | null; // 0 (52w low) … 100 (52w high)
  nextEarnings: string | null; // ISO
  daysToEarnings: number | null; // null when unknown or in the past
  lastSurprisePct: number | null;
  beats: number | null; // beat quarters out of `beatTotal`
  beatTotal: number | null;
  recBuys: number | null; // strong buy + buy, latest month
  recTotal: number | null;
  recDelta3m: number | null; // buy-rated count change vs ~3 months ago
  insiderNetUsd90d: number | null; // signed $ flow, non-derivative
  insiderBuys90d: number;
  insiderSells90d: number;
  /** False for TSX/fund rows — intel columns render as not-covered. */
  usCovered: boolean;
};

export type DeskMonitor = {
  rows: MonitorRow[];
  /** Held names reporting within the next 14 days. */
  reportingSoon: { symbol: string; days: number }[];
  /** Net insider flow across covered held names, last 90 days. */
  bookInsiderNetUsd: number;
  /** Largest analyst-rec migration among covered held names. */
  topRecShift: { symbol: string; delta: number } | null;
  asOf: string;
};

type SymbolSeed = {
  symbol: string;
  name: string | null;
  currency: string | null;
  held: boolean;
  weight: number;
  mvCad: number;
  isFund: boolean;
};

export async function getDeskMonitor(tenantId: string | null | undefined): Promise<DeskMonitor> {
  const svc = getMarketDataService();

  // ── Seed rows: held symbols (aggregated) + watch-only tickers ──
  const [investments, watchItems] = await Promise.all([
    tenantId ? loadInvestments(tenantId).catch(() => null) : Promise.resolve(null),
    tenantId
      ? prisma.watchlistItem.findMany({ where: { tenantId }, orderBy: { symbol: "asc" } })
      : Promise.resolve([]),
  ]);

  const holdings = investments?.holdings ?? [];
  const bySymbol = new Map<string, SymbolSeed>();
  for (const h of holdings) {
    const cur = bySymbol.get(h.symbol);
    if (cur) cur.mvCad += h.mvCAD;
    else
      bySymbol.set(h.symbol, {
        symbol: h.symbol,
        name: h.description,
        currency: h.currency,
        held: true,
        weight: 0,
        mvCad: h.mvCAD,
        isFund: h.type.toUpperCase() !== "STOCK" && h.type.toUpperCase() !== "ADR",
      });
  }
  const totalMv = [...bySymbol.values()].reduce((s, a) => s + a.mvCad, 0);
  for (const seed of bySymbol.values()) {
    seed.weight = totalMv > 0 ? (seed.mvCad / totalMv) * 100 : 0;
  }
  for (const w of watchItems) {
    const sym = w.symbol.toUpperCase();
    if (!bySymbol.has(sym)) {
      bySymbol.set(sym, {
        symbol: sym,
        name: w.name,
        currency: null,
        held: false,
        weight: 0,
        mvCad: 0,
        isFund: false,
      });
    }
  }

  const seeds = [...bySymbol.values()].sort((a, b) => {
    if (a.held !== b.held) return a.held ? -1 : 1;
    if (a.held) return b.mvCad - a.mvCad;
    return a.symbol.localeCompare(b.symbol);
  });

  // ── Market + intel data, all served via the Postgres caches ──
  const covered = (s: SymbolSeed) => !s.isFund && isUsListed(s.symbol);
  const [quotes, events, earnings, recs, insiders] = await Promise.all([
    svc.getQuotes(
      seeds.map((s) => s.symbol),
      QUOTE_MAX_AGE_MS
    ),
    mapLimit(seeds, CONCURRENCY, (s) =>
      s.isFund ? Promise.resolve(null) : svc.getEvents(s.symbol).catch(() => null)
    ),
    mapLimit(seeds, CONCURRENCY, (s) =>
      covered(s) ? getEarningsHistory(s.symbol).catch(() => []) : Promise.resolve([])
    ),
    mapLimit(seeds, CONCURRENCY, (s) =>
      covered(s) ? getRecTrends(s.symbol).catch(() => []) : Promise.resolve([])
    ),
    mapLimit(seeds, CONCURRENCY, (s) =>
      covered(s) ? getInsiderTxs(s.symbol).catch(() => []) : Promise.resolve([])
    ),
  ]);

  const now = Date.now();
  const cutoff90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows: MonitorRow[] = seeds.map((seed, i) => {
    const q = quotes[i];
    const rangePos52w =
      q && q.low52w != null && q.high52w != null && q.high52w > q.low52w
        ? Math.max(0, Math.min(100, ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100))
        : null;

    const nextEarnings = events[i]?.nextEarnings ?? null;
    let daysToEarnings: number | null = null;
    if (nextEarnings) {
      const d = Math.ceil((Date.parse(nextEarnings) - now) / (24 * 60 * 60 * 1000));
      if (d >= 0) daysToEarnings = d;
    }

    const surprises = earnings[i].filter((e) => e.surprisePct != null);
    const lastSurprisePct = surprises.at(-1)?.surprisePct ?? null;
    const beats = surprises.length
      ? surprises.filter((e) => (e.surprisePct ?? 0) >= 0).length
      : null;

    const trend = recs[i];
    const latestRec = trend.at(-1) ?? null;
    const baseRec = trend.length >= 2 ? (trend.at(-4) ?? trend[0]) : null;
    const buysOf = (r: { strongBuy: number; buy: number }) => r.strongBuy + r.buy;
    const totalOf = (r: {
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    }) => r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;

    let insiderNetUsd90d: number | null = null;
    let insiderBuys90d = 0;
    let insiderSells90d = 0;
    if (covered(seed)) {
      for (const t of insiders[i]) {
        if (!isOpenMarketInsiderTransaction(t) || t.txDate! < cutoff90) continue;
        const value = openMarketInsiderValue(t);
        if (value == null) continue;
        insiderNetUsd90d = (insiderNetUsd90d ?? 0) + value;
        if (t.txCode === "P") insiderBuys90d++;
        if (t.txCode === "S") insiderSells90d++;
      }
    }

    return {
      symbol: seed.symbol,
      name: seed.name,
      currency: seed.currency ?? q?.currency ?? null,
      held: seed.held,
      weight: seed.weight,
      mvCad: seed.mvCad,
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
      rangePos52w,
      nextEarnings,
      daysToEarnings,
      lastSurprisePct,
      beats,
      beatTotal: surprises.length || null,
      recBuys: latestRec ? buysOf(latestRec) : null,
      recTotal: latestRec ? totalOf(latestRec) : null,
      recDelta3m: latestRec && baseRec ? buysOf(latestRec) - buysOf(baseRec) : null,
      insiderNetUsd90d,
      insiderBuys90d,
      insiderSells90d,
      usCovered: covered(seed),
    };
  });

  // ── Desk-level callouts ──
  const reportingSoon = rows
    .filter((r) => r.held && r.daysToEarnings != null && r.daysToEarnings <= 14)
    .map((r) => ({ symbol: r.symbol, days: r.daysToEarnings! }))
    .sort((a, b) => a.days - b.days);

  const bookInsiderNetUsd = rows
    .filter((r) => r.held)
    .reduce((s, r) => s + (r.insiderNetUsd90d ?? 0), 0);

  const topRecShift =
    rows
      .filter((r) => r.held && r.recDelta3m != null && r.recDelta3m !== 0)
      .sort((a, b) => Math.abs(b.recDelta3m!) - Math.abs(a.recDelta3m!))
      .map((r) => ({ symbol: r.symbol, delta: r.recDelta3m! }))[0] ?? null;

  return { rows, reportingSoon, bookInsiderNetUsd, topRecShift, asOf: new Date().toISOString() };
}
