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
   */
  getNews(symbol: string, count?: number): Promise<NewsItem[]>;
}
