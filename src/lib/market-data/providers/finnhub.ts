import { getFinnhubApiKey } from "@/lib/env";

// ─── Finnhub raw fetchers (free tier) ───────────────────────────────────────
// US-listed symbols only — international data (e.g. .TO) is premium-gated, as
// are price targets. Free tier allows 60 req/min; callers cache results in
// Postgres (see intel.ts) so steady-state page loads cost zero calls here.

const BASE = "https://finnhub.io/api/v1";

async function fhFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = getFinnhubApiKey();
  if (!key) return null;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Finnhub returned HTTP ${res.status} for ${path}.`);
  return (await res.json()) as T;
}

// ── Quarterly EPS surprises ─────────────────────────────────────────────────

export type FinnhubEarnings = {
  period: string; // fiscal quarter end, YYYY-MM-DD
  quarter: number | null;
  year: number | null;
  actual: number | null;
  estimate: number | null;
  surprisePercent: number | null;
};

export async function fetchEarningsSurprises(symbol: string): Promise<FinnhubEarnings[]> {
  type Row = {
    period?: string;
    quarter?: number;
    year?: number;
    actual?: number;
    estimate?: number;
    surprisePercent?: number;
  };
  const rows = await fhFetch<Row[]>("/stock/earnings", { symbol });
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r.period === "string")
    .map((r) => ({
      period: r.period!,
      quarter: r.quarter ?? null,
      year: r.year ?? null,
      actual: r.actual ?? null,
      estimate: r.estimate ?? null,
      surprisePercent: r.surprisePercent ?? null,
    }));
}

// ── Monthly recommendation trends ───────────────────────────────────────────

export type FinnhubRecTrend = {
  period: string; // YYYY-MM-01
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export async function fetchRecommendationTrends(symbol: string): Promise<FinnhubRecTrend[]> {
  type Row = {
    period?: string;
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
  };
  const rows = await fhFetch<Row[]>("/stock/recommendation", { symbol });
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r.period === "string")
    .map((r) => ({
      period: r.period!,
      strongBuy: r.strongBuy ?? 0,
      buy: r.buy ?? 0,
      hold: r.hold ?? 0,
      sell: r.sell ?? 0,
      strongSell: r.strongSell ?? 0,
    }));
}

// ── Insider transactions (SEC Forms 3/4/5, via Finnhub) ────────────────────

export type FinnhubInsiderTx = {
  name: string;
  share: number | null; // shares held after the transaction
  change: number | null; // signed share delta
  transactionPrice: number | null;
  transactionCode: string | null; // P, S, M, A, F, G, …
  transactionDate: string | null; // YYYY-MM-DD
  filingDate: string | null;
  isDerivative: boolean;
};

export async function fetchInsiderTransactions(
  symbol: string,
  limit = 60
): Promise<FinnhubInsiderTx[]> {
  type Row = {
    name?: string;
    share?: number;
    change?: number;
    transactionPrice?: number;
    transactionCode?: string;
    transactionDate?: string;
    filingDate?: string;
    isDerivative?: boolean;
  };
  const body = await fhFetch<{ data?: Row[] }>("/stock/insider-transactions", { symbol });
  const rows = body?.data;
  if (!Array.isArray(rows)) return [];
  // Finnhub ignores its documented `limit` param (observed: 300+ rows back) —
  // cap to the most recent transactions ourselves before they hit Postgres.
  return rows
    .filter((r) => typeof r.name === "string")
    .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""))
    .slice(0, limit)
    .map((r) => ({
      name: r.name!,
      share: r.share ?? null,
      change: r.change ?? null,
      transactionPrice: r.transactionPrice ?? null,
      transactionCode: r.transactionCode ?? null,
      transactionDate: r.transactionDate ?? null,
      filingDate: r.filingDate ?? null,
      isDerivative: r.isDerivative ?? false,
    }));
}

// ── Industry peers ──────────────────────────────────────────────────────────

export async function fetchPeers(symbol: string): Promise<string[]> {
  const rows = await fhFetch<string[]>("/stock/peers", { symbol });
  if (!Array.isArray(rows)) return [];
  // Finnhub includes the symbol itself and occasionally non-US listings
  // (suffix/prefix forms like "7203.T") — keep clean US tickers only.
  return rows.filter(
    (p) => typeof p === "string" && p !== symbol && /^[A-Z][A-Z0-9]{0,5}$/.test(p)
  );
}
