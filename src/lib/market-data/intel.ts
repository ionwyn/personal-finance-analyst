import { logger, safeError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { fetchRecentFilings, type EdgarFiling } from "./providers/edgar";
import {
  fetchEarningsSurprises,
  fetchInsiderTransactions,
  fetchPeers,
  fetchRecommendationTrends,
} from "./providers/finnhub";
import { fetchAnnualIncomeStatements } from "./providers/fmp";

// ─── Symbol intelligence: earnings, recs, insiders, peers, filings, financials ──
// Provider-specific research data that doesn't fit the quote-style
// MarketDataProvider interface. Each getter follows the macro.ts pattern:
// serve from Postgres while fresh, refresh from the provider when stale, fall
// back to whatever is cached on provider failure. MarketIntelFetch records
// every attempt — including ones that returned nothing — so ETFs and non-US
// listings don't hit providers on every page view.

const TTL_MS = {
  earnings: 24 * 60 * 60 * 1000, // quarterly data, refreshed daily
  recs: 24 * 60 * 60 * 1000, // monthly snapshots, refreshed daily
  insiders: 12 * 60 * 60 * 1000, // new Form 4s land intraday
  peers: 7 * 24 * 60 * 60 * 1000, // industry membership barely moves
  filings: 12 * 60 * 60 * 1000, // 8-Ks land intraday
  financials: 7 * 24 * 60 * 60 * 1000, // annual statements
} as const;

type IntelKind = keyof typeof TTL_MS;

/** US-listed common-share tickers (Finnhub free tier and EDGAR coverage).
 *  Suffixed listings like VFV.TO and class shares like BRK.B are excluded. */
export function isUsListed(symbol: string): boolean {
  return /^[A-Z][A-Z0-9]{0,5}$/.test(symbol.toUpperCase());
}

async function isFresh(symbol: string, kind: IntelKind): Promise<boolean> {
  const row = await prisma.marketIntelFetch.findUnique({
    where: { symbol_kind: { symbol, kind } },
  });
  return row != null && Date.now() - row.fetchedAt.getTime() < TTL_MS[kind];
}

async function markFetched(symbol: string, kind: IntelKind) {
  await prisma.marketIntelFetch.upsert({
    where: { symbol_kind: { symbol, kind } },
    create: { symbol, kind },
    update: { fetchedAt: new Date() },
  });
}

function n(v: { toNumber(): number } | number | null | undefined): number | null {
  if (v == null) return null;
  return typeof v === "number" ? v : v.toNumber();
}

// ── Earnings surprises ──────────────────────────────────────────────────────

export type EarningsQuarter = {
  period: string; // fiscal quarter end, YYYY-MM-DD
  quarter: number | null;
  year: number | null;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
};

export async function getEarningsHistory(symbol: string): Promise<EarningsQuarter[]> {
  const cached = () =>
    prisma.marketEarnings.findMany({ where: { symbol }, orderBy: { period: "asc" } }).then((rows) =>
      rows.map((r) => ({
        period: r.period,
        quarter: r.quarter,
        year: r.year,
        epsActual: n(r.epsActual),
        epsEstimate: n(r.epsEstimate),
        surprisePct: n(r.surprisePct),
      }))
    );

  if (await isFresh(symbol, "earnings")) return cached();
  try {
    const fresh = await fetchEarningsSurprises(symbol);
    await prisma.$transaction([
      ...(fresh.length > 0
        ? [
            prisma.marketEarnings.deleteMany({ where: { symbol } }),
            prisma.marketEarnings.createMany({
              data: fresh.map((e) => ({
                symbol,
                period: e.period,
                quarter: e.quarter,
                year: e.year,
                epsActual: e.actual,
                epsEstimate: e.estimate,
                surprisePct: e.surprisePercent,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    await markFetched(symbol, "earnings");
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "earnings refresh failed");
  }
  return cached();
}

// ── Recommendation trends ───────────────────────────────────────────────────

export type RecTrendMonth = {
  period: string; // YYYY-MM-01
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export async function getRecTrends(symbol: string): Promise<RecTrendMonth[]> {
  const cached = () =>
    prisma.marketRecTrend.findMany({ where: { symbol }, orderBy: { period: "asc" } }).then((rows) =>
      rows.map((r) => ({
        period: r.period,
        strongBuy: r.strongBuy,
        buy: r.buy,
        hold: r.hold,
        sell: r.sell,
        strongSell: r.strongSell,
      }))
    );

  if (await isFresh(symbol, "recs")) return cached();
  try {
    const fresh = await fetchRecommendationTrends(symbol);
    if (fresh.length > 0) {
      await prisma.$transaction([
        prisma.marketRecTrend.deleteMany({ where: { symbol } }),
        prisma.marketRecTrend.createMany({
          data: fresh.map((r) => ({ symbol, ...r })),
          skipDuplicates: true,
        }),
      ]);
    }
    await markFetched(symbol, "recs");
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "rec trends refresh failed");
  }
  return cached();
}

// ── Insider transactions ────────────────────────────────────────────────────

export type InsiderTx = {
  name: string;
  share: number | null;
  change: number | null;
  txPrice: number | null;
  txCode: string | null;
  txDate: string | null;
  filingDate: string | null;
  isDerivative: boolean;
};

export async function getInsiderTxs(symbol: string): Promise<InsiderTx[]> {
  const cached = () =>
    prisma.marketInsiderTx
      .findMany({ where: { symbol }, orderBy: { txDate: "desc" } })
      .then((rows) =>
        rows.map((r) => ({
          name: r.name,
          share: r.share != null ? Number(r.share) : null,
          change: r.change != null ? Number(r.change) : null,
          txPrice: n(r.txPrice),
          txCode: r.txCode,
          txDate: r.txDate,
          filingDate: r.filingDate,
          isDerivative: r.isDerivative,
        }))
      );

  if (await isFresh(symbol, "insiders")) return cached();
  try {
    const fresh = await fetchInsiderTransactions(symbol);
    if (fresh.length > 0) {
      await prisma.$transaction([
        prisma.marketInsiderTx.deleteMany({ where: { symbol } }),
        prisma.marketInsiderTx.createMany({
          data: fresh.map((t) => ({
            symbol,
            name: t.name,
            share: t.share != null ? BigInt(Math.round(t.share)) : null,
            change: t.change != null ? BigInt(Math.round(t.change)) : null,
            txPrice: t.transactionPrice,
            txCode: t.transactionCode,
            txDate: t.transactionDate,
            filingDate: t.filingDate,
            isDerivative: t.isDerivative,
          })),
        }),
      ]);
    }
    await markFetched(symbol, "insiders");
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "insider txs refresh failed");
  }
  return cached();
}

// ── Peers ───────────────────────────────────────────────────────────────────

export async function getPeers(symbol: string): Promise<string[]> {
  const cached = await prisma.marketPeers.findUnique({ where: { symbol } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS.peers) return cached.peers;
  try {
    const fresh = await fetchPeers(symbol);
    await prisma.marketPeers.upsert({
      where: { symbol },
      create: { symbol, peers: fresh, fetchedAt: new Date() },
      update: { peers: fresh, fetchedAt: new Date() },
    });
    return fresh;
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "peers refresh failed");
    return cached?.peers ?? [];
  }
}

// ── SEC filings ─────────────────────────────────────────────────────────────

export type SecFiling = EdgarFiling;

export async function getFilings(symbol: string): Promise<SecFiling[]> {
  const cached = () =>
    prisma.marketFiling.findMany({ where: { symbol }, orderBy: { filedAt: "desc" } }).then((rows) =>
      rows.map((r) => ({
        accession: r.accession,
        form: r.form,
        filedAt: r.filedAt,
        title: r.title,
        url: r.url,
      }))
    );

  if (await isFresh(symbol, "filings")) return cached();
  try {
    const fresh = await fetchRecentFilings(symbol);
    // null → not an SEC registrant; record the attempt and stay empty.
    if (fresh != null && fresh.length > 0) {
      await prisma.$transaction([
        prisma.marketFiling.deleteMany({ where: { symbol } }),
        prisma.marketFiling.createMany({
          data: fresh.map((f) => ({ symbol, ...f })),
          skipDuplicates: true,
        }),
      ]);
    }
    await markFetched(symbol, "filings");
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "filings refresh failed");
  }
  return cached();
}

// ── Annual financials ───────────────────────────────────────────────────────

export type AnnualFinancials = {
  fiscalYear: string;
  endDate: string | null;
  currency: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
};

export async function getFinancials(symbol: string): Promise<AnnualFinancials[]> {
  const cached = () =>
    prisma.marketFinancials
      .findMany({ where: { symbol }, orderBy: { fiscalYear: "asc" } })
      .then((rows) =>
        rows.map((r) => ({
          fiscalYear: r.fiscalYear,
          endDate: r.endDate,
          currency: r.currency,
          revenue: n(r.revenue),
          grossProfit: n(r.grossProfit),
          operatingIncome: n(r.operatingIncome),
          netIncome: n(r.netIncome),
          epsDiluted: n(r.epsDiluted),
        }))
      );

  if (await isFresh(symbol, "financials")) return cached();
  try {
    const fresh = await fetchAnnualIncomeStatements(symbol);
    if (fresh.length > 0) {
      await prisma.$transaction([
        prisma.marketFinancials.deleteMany({ where: { symbol } }),
        prisma.marketFinancials.createMany({
          data: fresh.map((f) => ({ symbol, ...f })),
          skipDuplicates: true,
        }),
      ]);
    }
    await markFetched(symbol, "financials");
  } catch (error) {
    logger.warn({ symbol, error: safeError(error) }, "financials refresh failed");
  }
  return cached();
}

// ── Combined fetch for the position / symbol pages ─────────────────────────

export type SymbolIntel = {
  earnings: EarningsQuarter[];
  recTrends: RecTrendMonth[];
  insiders: InsiderTx[];
  peers: string[];
  filings: SecFiling[];
  financials: AnnualFinancials[];
};

const EMPTY_INTEL: SymbolIntel = {
  earnings: [],
  recTrends: [],
  insiders: [],
  peers: [],
  filings: [],
  financials: [],
};

/**
 * Everything the research panels need for one symbol. Funds and non-US
 * listings short-circuit to empty — none of these datasets exist for them on
 * the free tiers (Yahoo continues to cover quotes/news/dividends there).
 */
export async function getSymbolIntel(
  symbol: string,
  opts?: { isFund?: boolean }
): Promise<SymbolIntel> {
  const sym = symbol.toUpperCase();
  if (opts?.isFund || !isUsListed(sym)) return EMPTY_INTEL;

  const [earnings, recTrends, insiders, peers, filings, financials] = await Promise.all([
    getEarningsHistory(sym).catch(() => [] as EarningsQuarter[]),
    getRecTrends(sym).catch(() => [] as RecTrendMonth[]),
    getInsiderTxs(sym).catch(() => [] as InsiderTx[]),
    getPeers(sym).catch(() => [] as string[]),
    getFilings(sym).catch(() => [] as SecFiling[]),
    getFinancials(sym).catch(() => [] as AnnualFinancials[]),
  ]);
  return { earnings, recTrends, insiders, peers, filings, financials };
}
