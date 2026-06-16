import { getInsiderTxs, isUsListed } from "@/lib/market-data";
import { isOpenMarketInsiderTransaction, openMarketInsiderValue } from "@/lib/market-data/insiders";
import { prisma } from "@/lib/prisma";

import { loadInvestments } from "./loader";
import { mapLimit } from "./shared/concurrency";

// ─── Insider tape — cross-holdings Form-4 feed (OpenInsider-style) ──────────
// One row per open-market insider transaction across held + watch-only US
// single names, flattened and sorted newest-first. Every symbol's trades come
// straight from the MarketInsiderTx cache (12 h TTL via getInsiderTxs), so a
// warm visit issues zero provider calls; the cold sweep is bounded by mapLimit
// to stay inside Finnhub's 60 req/min — same budget as the desk monitor.
//
// The loader stays deliberately dumb: it returns every transaction inside the
// widest window and lets the client narrow (30/90/180d) and re-aggregate, so
// the summary always tracks the active filter.

const CONCURRENCY = 4;
const WINDOW_DAYS = 180;

export type InsiderTapeRow = {
  symbol: string;
  held: boolean;
  weight: number; // % of holdings MV (0 for watch-only)
  person: string;
  txCode: string; // "P" (buy) | "S" (sell)
  change: number; // signed share delta
  txPrice: number | null;
  valueUsd: number; // signed: + buy, − sell
  txDate: string; // YYYY-MM-DD
  filingDate: string | null;
  sharesAfter: number | null;
  ownChangePct: number | null; // change / pre-transaction holding
};

export type InsiderTape = {
  rows: InsiderTapeRow[]; // open-market only, ≤ WINDOW_DAYS, newest first
  coveredCount: number; // US single names actually scanned
  heldCount: number; // held names in the book
  windowDays: number;
  asOf: string;
};

type SymbolSeed = {
  symbol: string;
  name: string | null;
  held: boolean;
  weight: number;
  mvCad: number;
  isFund: boolean;
};

export async function getInsiderTape(tenantId: string | null | undefined): Promise<InsiderTape> {
  // ── Seed the universe: held symbols (aggregated) + watch-only tickers ──
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
        held: false,
        weight: 0,
        mvCad: 0,
        isFund: false,
      });
    }
  }

  // ── Only US single names carry insider data on the free tier ──
  const covered = [...bySymbol.values()].filter((s) => !s.isFund && isUsListed(s.symbol));
  const txLists = await mapLimit(covered, CONCURRENCY, (s) =>
    getInsiderTxs(s.symbol).catch(() => [])
  );

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows: InsiderTapeRow[] = [];
  covered.forEach((seed, i) => {
    for (const t of txLists[i]) {
      if (!isOpenMarketInsiderTransaction(t) || (t.txDate ?? "") < cutoff) continue;
      const valueUsd = openMarketInsiderValue(t);
      if (valueUsd == null) continue;
      const pre = t.share != null && t.change != null ? t.share - t.change : null;
      rows.push({
        symbol: seed.symbol,
        held: seed.held,
        weight: seed.weight,
        person: t.name,
        txCode: t.txCode!, // P or S — guaranteed by isOpenMarketInsiderTransaction
        change: t.change ?? 0,
        txPrice: t.txPrice,
        valueUsd,
        txDate: t.txDate!,
        filingDate: t.filingDate,
        sharesAfter: t.share,
        ownChangePct: pre != null && pre > 0 && t.change != null ? (t.change / pre) * 100 : null,
      });
    }
  });

  // Newest first; tie-break on filing date (later filing surfaces first).
  rows.sort((a, b) => {
    if (a.txDate !== b.txDate) return a.txDate < b.txDate ? 1 : -1;
    return (a.filingDate ?? "") < (b.filingDate ?? "") ? 1 : -1;
  });

  return {
    rows,
    coveredCount: covered.length,
    heldCount: [...bySymbol.values()].filter((s) => s.held).length,
    windowDays: WINDOW_DAYS,
    asOf: new Date().toISOString(),
  };
}
