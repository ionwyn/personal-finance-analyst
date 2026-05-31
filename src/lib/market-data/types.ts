// ─── Shared data types (provider-agnostic) ────────────────────────────────
// All numbers are in the security's native currency unless noted otherwise.

export type MarketQuote = {
  symbol: string;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  open: number | null;
  high52w: number | null;
  low52w: number | null;
  volume: number | null;
  marketCap: number | null;
  fetchedAt: string; // ISO
};

export type PricePoint = {
  date: string; // YYYY-MM-DD
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

export type SecurityProfile = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  description: string | null;
  fetchedAt: string;
};

export type SecurityFundamentals = {
  symbol: string;
  isFund: boolean;
  // Stock metrics
  peRatio: number | null;
  forwardPe: number | null;
  pbRatio: number | null;
  evEbitda: number | null;
  revenueGrowthPct: number | null;
  epsGrowthPct: number | null;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  freeCashFlow: number | null;
  dividendYieldPct: number | null;
  // ETF-specific
  expenseRatioPct: number | null;
  aum: number | null;
  holdingsCount: number | null;
  fetchedAt: string;
};

export type NewsItem = {
  title: string;
  source: string | null;
  url: string | null;
  publishedAt: string | null; // ISO
  summary: string | null;
  relatedTickers: string[]; // tickers the provider associates with the story
};

// Deterministic category derived from the headline (no AI — keyword rules).
export type NewsTag =
  | "DIVIDEND"
  | "ANALYST"
  | "EARNINGS"
  | "REGULATORY"
  | "M&A"
  | "PRODUCT"
  | "SECTOR"
  | "NEWS";

// Relevance to the holding, derived from relatedTickers membership.
export type NewsRelevance = "high" | "med" | "low";

export type RankedNewsItem = NewsItem & {
  tag: NewsTag;
  relevance: NewsRelevance;
};

// Upcoming corporate calendar (stocks only; ETFs return null).
export type MarketEvents = {
  symbol: string;
  nextEarnings: string | null; // ISO
  exDividend: string | null; // ISO
  dividendDate: string | null; // ISO
  fetchedAt: string;
};

// ─── Provider interface ────────────────────────────────────────────────────
// Implement this to swap the underlying data source without touching anything
// outside of src/lib/market-data/providers/.

export interface MarketDataProvider {
  /**
   * Current quote: price, day change, 52-week range.
   * Returns null when the symbol is not found or the provider is unavailable.
   */
  getQuote(symbol: string): Promise<MarketQuote | null>;

  /**
   * Daily OHLCV close history, newest-last, up to `days` calendar days back.
   * Returns an empty array on failure — callers must treat [] as "no data".
   */
  getTimeSeries(symbol: string, days: number): Promise<PricePoint[]>;

  /**
   * Fundamentals: valuation multiples, margins, and ETF metrics.
   * Returns null when not available (e.g. some ETFs on free sources).
   */
  getFundamentals(symbol: string): Promise<SecurityFundamentals | null>;

  /**
   * Static profile: sector, industry, country, long description.
   * Returns null when not available.
   */
  getProfile(symbol: string): Promise<SecurityProfile | null>;

  /**
   * Recent news headlines, ordered newest-first. Empty array on failure.
   * Each item carries `relatedTickers` so the service can score relevance.
   */
  getNews(symbol: string, count?: number): Promise<NewsItem[]>;

  /**
   * Upcoming corporate calendar (earnings, ex-dividend, dividend dates).
   * Returns null when not available (ETFs, or provider failure).
   */
  getEvents(symbol: string): Promise<MarketEvents | null>;
}
