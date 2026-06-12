import {
  getCanadaMacro,
  getMacroOverview,
  getMarketDataService,
  getYieldCurve,
  type MacroIndicator,
  type YieldCurveData,
} from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import { loadInvestments } from "./loader";

// ─── Markets overview (tape + personal movers + macro) ─────────────────────
// Everything here flows through the MarketQuote / MacroPoint caches, so a
// page load costs zero external calls when the caches are warm.

/** Tape quotes refresh faster than position quotes — it's the pulse strip. */
const TAPE_MAX_AGE_MS = 15 * 60 * 1000;
const HOLDINGS_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;

export type TapeKind = "index" | "vol" | "fx" | "commodity" | "crypto";

type TapeInstrument = {
  id: string;
  label: string;
  symbol: string; // Yahoo symbol
  kind: TapeKind;
  decimals: number;
};

const TAPE: TapeInstrument[] = [
  { id: "spx", label: "S&P 500", symbol: "^GSPC", kind: "index", decimals: 0 },
  { id: "ndx", label: "NASDAQ", symbol: "^IXIC", kind: "index", decimals: 0 },
  { id: "dji", label: "DOW", symbol: "^DJI", kind: "index", decimals: 0 },
  { id: "tsx", label: "TSX", symbol: "^GSPTSE", kind: "index", decimals: 0 },
  { id: "vix", label: "VIX", symbol: "^VIX", kind: "vol", decimals: 1 },
  { id: "usdcad", label: "USD/CAD", symbol: "CAD=X", kind: "fx", decimals: 4 },
  { id: "wti", label: "WTI CRUDE", symbol: "CL=F", kind: "commodity", decimals: 2 },
  { id: "gold", label: "GOLD", symbol: "GC=F", kind: "commodity", decimals: 0 },
  { id: "btc", label: "BITCOIN", symbol: "BTC-USD", kind: "crypto", decimals: 0 },
];

export type TapeQuote = {
  id: string;
  label: string;
  symbol: string;
  kind: TapeKind;
  decimals: number;
  value: number | null;
  change: number | null;
  changePct: number | null;
};

export type MoverRow = {
  symbol: string;
  name: string;
  currency: string;
  logoBg: string;
  logoId: string | null;
  price: number | null; // last market price, native
  changePct: number | null; // day move, native terms
  dayPlCad: number | null; // my estimated CAD impact today (price move only)
  mvCad: number;
  weight: number; // % of holdings MV
};

export type MarketsPortfolioPulse = {
  mvCad: number;
  /** Estimated day P&L across holdings with live quotes (price move, ex-FX). */
  dayPlCad: number;
  dayPlPct: number;
  /** Share of holdings MV that had a live quote behind the estimate. */
  coveragePct: number;
  movers: MoverRow[];
};

export type WatchlistRow = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  changePct: number | null;
  held: boolean; // also present in current holdings
  spark: number[]; // ~30 trading days of closes, oldest → newest
};

export type MarketsOverview = {
  tape: TapeQuote[];
  portfolio: MarketsPortfolioPulse | null;
  watchlist: WatchlistRow[];
  macro: MacroIndicator[];
  canada: MacroIndicator[];
  curve: YieldCurveData;
  asOf: string; // ISO — page assembly time
};

/** Watchlist rows with quotes and 30-day sparklines (all served from cache). */
async function loadWatchlist(
  tenantId: string | null | undefined,
  heldSymbols: Set<string>
): Promise<WatchlistRow[]> {
  if (!tenantId) return [];
  const svc = getMarketDataService();
  const items = await prisma.watchlistItem.findMany({
    where: { tenantId },
    orderBy: { addedAt: "asc" },
  });
  if (items.length === 0) return [];

  const [quotes, serieses] = await Promise.all([
    svc.getQuotes(
      items.map((i) => i.symbol),
      HOLDINGS_QUOTE_MAX_AGE_MS
    ),
    Promise.all(items.map((i) => svc.getTimeSeries(i.symbol, 45).catch(() => []))),
  ]);

  return items.map((item, i) => {
    const q = quotes[i];
    return {
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
      currency: q?.currency ?? null,
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
      held: heldSymbols.has(item.symbol.toUpperCase()),
      spark: serieses[i].slice(-30).map((p) => p.close),
    };
  });
}

export async function getMarketsOverview(
  tenantId: string | null | undefined
): Promise<MarketsOverview> {
  const svc = getMarketDataService();

  const [tapeQuotes, macro, canada, curve, investments] = await Promise.all([
    svc.getQuotes(
      TAPE.map((t) => t.symbol),
      TAPE_MAX_AGE_MS
    ),
    getMacroOverview().catch(() => [] as MacroIndicator[]),
    getCanadaMacro().catch(() => [] as MacroIndicator[]),
    getYieldCurve().catch(() => ({ points: [], asOf: null }) as YieldCurveData),
    tenantId ? loadInvestments(tenantId).catch(() => null) : Promise.resolve(null),
  ]);

  const tape: TapeQuote[] = TAPE.map((t, i) => {
    const q = tapeQuotes[i];
    return {
      id: t.id,
      label: t.label,
      symbol: t.symbol,
      kind: t.kind,
      decimals: t.decimals,
      value: q?.price ?? null,
      change: q?.change ?? null,
      changePct: q?.changePct ?? null,
    };
  });

  // ── Personal pulse: aggregate holdings by symbol, price each once ──
  let portfolio: MarketsPortfolioPulse | null = null;
  const holdings = investments?.holdings ?? [];
  if (holdings.length > 0) {
    type Agg = {
      symbol: string;
      name: string;
      currency: string;
      logoBg: string;
      logoId: string | null;
      mvCad: number;
    };
    const bySymbol = new Map<string, Agg>();
    for (const h of holdings) {
      const cur = bySymbol.get(h.symbol);
      if (cur) cur.mvCad += h.mvCAD;
      else
        bySymbol.set(h.symbol, {
          symbol: h.symbol,
          name: h.description,
          currency: h.currency,
          logoBg: h.logoBg,
          logoId: h.logoId,
          mvCad: h.mvCAD,
        });
    }
    const aggs = [...bySymbol.values()];
    const totalMv = aggs.reduce((s, a) => s + a.mvCad, 0);

    const quotes = await svc.getQuotes(
      aggs.map((a) => a.symbol),
      HOLDINGS_QUOTE_MAX_AGE_MS
    );

    let dayPlCad = 0;
    let coveredMv = 0;
    const movers: MoverRow[] = aggs.map((a, i) => {
      const q = quotes[i];
      const changePct = q?.changePct ?? null;
      const dayPl = changePct != null ? (a.mvCad * changePct) / 100 : null;
      if (dayPl != null) {
        dayPlCad += dayPl;
        coveredMv += a.mvCad;
      }
      return {
        symbol: a.symbol,
        name: a.name,
        currency: a.currency,
        logoBg: a.logoBg,
        logoId: a.logoId,
        price: q?.price ?? null,
        changePct,
        dayPlCad: dayPl,
        mvCad: a.mvCad,
        weight: totalMv > 0 ? (a.mvCad / totalMv) * 100 : 0,
      };
    });

    movers.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));

    portfolio = {
      mvCad: totalMv,
      dayPlCad,
      dayPlPct: coveredMv > 0 ? (dayPlCad / coveredMv) * 100 : 0,
      coveragePct: totalMv > 0 ? (coveredMv / totalMv) * 100 : 0,
      movers,
    };
  }

  const heldSymbols = new Set(holdings.map((h) => h.symbol.toUpperCase()));
  const watchlist = await loadWatchlist(tenantId, heldSymbols);

  return { tape, portfolio, watchlist, macro, canada, curve, asOf: new Date().toISOString() };
}
