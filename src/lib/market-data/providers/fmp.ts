import { getFmpApiKey } from "@/lib/env";

// ─── Financial Modeling Prep raw fetchers (free tier) ───────────────────────
// Free plan allows 250 req/day — used only for annual income statements,
// cached 7 days per symbol (see intel.ts), so realistic usage is a handful of
// calls per week.

const BASE = "https://financialmodelingprep.com/stable";

async function fmpFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = getFmpApiKey();
  if (!key) return null;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FMP returned HTTP ${res.status} for ${path}.`);
  return (await res.json()) as T;
}

export type FmpIncomeStatement = {
  fiscalYear: string;
  endDate: string | null; // YYYY-MM-DD
  currency: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
};

export async function fetchAnnualIncomeStatements(
  symbol: string,
  years = 5
): Promise<FmpIncomeStatement[]> {
  type Row = {
    fiscalYear?: string;
    date?: string;
    reportedCurrency?: string;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    epsDiluted?: number;
  };
  const rows = await fmpFetch<Row[]>("/income-statement", {
    symbol,
    limit: String(years),
  });
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r.fiscalYear === "string")
    .map((r) => ({
      fiscalYear: r.fiscalYear!,
      endDate: r.date ?? null,
      currency: r.reportedCurrency ?? null,
      revenue: r.revenue ?? null,
      grossProfit: r.grossProfit ?? null,
      operatingIncome: r.operatingIncome ?? null,
      netIncome: r.netIncome ?? null,
      epsDiluted: r.epsDiluted ?? null,
    }));
}
