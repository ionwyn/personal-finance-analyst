import { getEdgarUserAgent } from "@/lib/env";

// ─── SEC EDGAR raw fetchers ─────────────────────────────────────────────────
// No API key — the SEC requires a descriptive User-Agent with contact info
// and asks for ≤10 req/s. Only SEC registrants appear here (US listings and
// cross-listed foreign issuers); lookups for anything else return null.

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;

async function edgarFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": getEdgarUserAgent(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`EDGAR returned HTTP ${res.status} for ${url}.`);
  return (await res.json()) as T;
}

// ── Ticker → CIK map (one ~1 MB file, held in module memory) ───────────────

let tickerMap: Map<string, { cik: number; title: string }> | null = null;
let tickerMapFetchedAt = 0;

export async function lookupCik(symbol: string): Promise<{ cik: number; title: string } | null> {
  if (!tickerMap || Date.now() - tickerMapFetchedAt > TICKER_MAP_TTL_MS) {
    type Entry = { cik_str: number; ticker: string; title: string };
    const body = await edgarFetch<Record<string, Entry>>(TICKER_MAP_URL);
    tickerMap = new Map(
      Object.values(body).map((e) => [e.ticker.toUpperCase(), { cik: e.cik_str, title: e.title }])
    );
    tickerMapFetchedAt = Date.now();
  }
  return tickerMap.get(symbol.toUpperCase()) ?? null;
}

// ── Recent filings (submissions feed) ───────────────────────────────────────

export type EdgarFiling = {
  accession: string; // e.g. 0000002488-26-000105
  form: string; // 10-K | 10-Q | 8-K | DEF 14A | …
  filedAt: string; // YYYY-MM-DD
  title: string | null; // primary document description
  url: string; // direct link to the primary document
};

// Disclosure forms worth surfacing. Forms 3/4/5 are excluded — insider
// activity has its own panel sourced from Finnhub. "/A" amendments of these
// forms are kept (matched on the base form).
const KEY_FORMS = new Set([
  "10-K",
  "10-Q",
  "8-K",
  "20-F",
  "40-F",
  "6-K",
  "DEF 14A",
  "DEFM14A",
  "S-1",
  "S-3",
  "S-8",
  "SC 13D",
  "SC 13G",
  "424B5",
]);

export async function fetchRecentFilings(
  symbol: string,
  maxCount = 12
): Promise<EdgarFiling[] | null> {
  const company = await lookupCik(symbol);
  if (!company) return null;

  const padded = String(company.cik).padStart(10, "0");
  type Submissions = {
    filings?: {
      recent?: {
        accessionNumber?: string[];
        form?: string[];
        filingDate?: string[];
        primaryDocument?: string[];
        primaryDocDescription?: string[];
      };
    };
  };
  const body = await edgarFetch<Submissions>(`https://data.sec.gov/submissions/CIK${padded}.json`);
  const r = body.filings?.recent;
  if (!r?.accessionNumber || !r.form || !r.filingDate) return [];

  const filings: EdgarFiling[] = [];
  for (let i = 0; i < r.accessionNumber.length && filings.length < maxCount; i++) {
    const form = r.form[i];
    const baseForm = form?.replace(/\/A$/, "");
    if (!form || !baseForm || !KEY_FORMS.has(baseForm)) continue;
    const accession = r.accessionNumber[i];
    const doc = r.primaryDocument?.[i];
    const accessionPath = accession.replace(/-/g, "");
    filings.push({
      accession,
      form,
      filedAt: r.filingDate[i],
      title: r.primaryDocDescription?.[i] || null,
      url: doc
        ? `https://www.sec.gov/Archives/edgar/data/${company.cik}/${accessionPath}/${doc}`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=${encodeURIComponent(form)}`,
    });
  }
  return filings;
}
