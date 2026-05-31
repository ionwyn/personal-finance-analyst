import YahooFinance from "yahoo-finance2";

import type {
  MarketDataProvider,
  MarketQuote,
  NewsItem,
  PricePoint,
  SecurityFundamentals,
  SecurityProfile,
} from "../types";

// ─── Singleton client ─────────────────────────────────────────────────────
// One instance shared across all calls in the Node process.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// ─── Symbol convention ────────────────────────────────────────────────────
// SnapTrade stores TSX tickers as "VFV.TO"; Yahoo Finance uses the same
// convention, so no transformation is needed. US symbols pass through unchanged.
function toYahoo(symbol: string): string {
  return symbol;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}

function toISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    const t = d.getTime();
    return Number.isFinite(t) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

function toDateStr(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ─── Provider implementation ───────────────────────────────────────────────

export class YahooFinanceProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      const q = await yf.quote(toYahoo(symbol));
      if (!q) return null;
      return {
        symbol,
        currency: (q as { currency?: string }).currency ?? "USD",
        price: safeNum((q as { regularMarketPrice?: number }).regularMarketPrice) ?? 0,
        change: safeNum((q as { regularMarketChange?: number }).regularMarketChange) ?? 0,
        changePct:
          safeNum((q as { regularMarketChangePercent?: number }).regularMarketChangePercent) ?? 0,
        open: safeNum((q as { regularMarketOpen?: number }).regularMarketOpen),
        high52w: safeNum((q as { fiftyTwoWeekHigh?: number }).fiftyTwoWeekHigh),
        low52w: safeNum((q as { fiftyTwoWeekLow?: number }).fiftyTwoWeekLow),
        volume: safeNum((q as { regularMarketVolume?: number }).regularMarketVolume),
        marketCap: safeNum((q as { marketCap?: number }).marketCap),
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getTimeSeries(symbol: string, days: number): Promise<PricePoint[]> {
    try {
      const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      // Use chart() directly — historical() is deprecated in yahoo-finance2 v3.
      const result = await yf.chart(toYahoo(symbol), { period1, interval: "1d" });
      const rows = (result.quotes ?? []) as Array<{
        date: Date;
        close: number | null;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        volume?: number | null;
      }>;
      return rows
        .filter((r) => r.close != null)
        .map((r) => ({
          date: toDateStr(r.date) ?? "",
          close: r.close!,
          open: safeNum(r.open),
          high: safeNum(r.high),
          low: safeNum(r.low),
          volume: safeNum(r.volume),
        }))
        .filter((r) => r.date)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
    } catch {
      return [];
    }
  }

  async getFundamentals(symbol: string): Promise<SecurityFundamentals | null> {
    try {
      const s = await yf.quoteSummary(toYahoo(symbol), {
        modules: ["summaryDetail", "financialData", "defaultKeyStatistics"],
      });

      const sd = s.summaryDetail as Record<string, unknown> | undefined;
      const fd = s.financialData as Record<string, unknown> | undefined;
      const ks = s.defaultKeyStatistics as Record<string, unknown> | undefined;

      const pct = (v: unknown) => (safeNum(v) != null ? safeNum(v)! * 100 : null);

      return {
        symbol,
        isFund: false, // determined by caller via position.isFund
        peRatio: safeNum(sd?.trailingPE),
        forwardPe: safeNum(sd?.forwardPE),
        pbRatio: safeNum(ks?.priceToBook),
        evEbitda: safeNum(ks?.enterpriseToEbitda),
        revenueGrowthPct: pct(fd?.revenueGrowth),
        epsGrowthPct: pct(ks?.earningsQuarterlyGrowth),
        grossMarginPct: pct(fd?.grossMargins),
        operatingMarginPct: pct(fd?.operatingMargins),
        freeCashFlow: safeNum(fd?.freeCashflow),
        dividendYieldPct: pct(sd?.dividendYield),
        expenseRatioPct: null,
        aum: safeNum(ks?.netAssets),
        holdingsCount: null,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getProfile(symbol: string): Promise<SecurityProfile | null> {
    try {
      const s = await yf.quoteSummary(toYahoo(symbol), { modules: ["assetProfile"] });
      const p = s.assetProfile as Record<string, unknown> | undefined;
      if (!p) return null;
      return {
        symbol,
        name: null, // comes from quote, not assetProfile
        sector: (p.sector as string | undefined) ?? null,
        industry: (p.industry as string | undefined) ?? null,
        country: (p.country as string | undefined) ?? null,
        description: (p.longBusinessSummary as string | undefined) ?? null,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getNews(symbol: string, count = 6): Promise<NewsItem[]> {
    try {
      const result = await yf.search(toYahoo(symbol), {
        newsCount: count,
        quotesCount: 0,
      });
      const news = (result as { news?: unknown[] }).news ?? [];
      return news.slice(0, count).map((n) => {
        const item = n as Record<string, unknown>;
        const rawTs = item.providerPublishTime as number | undefined;
        return {
          title: (item.title as string | undefined) ?? "",
          source: (item.publisher as string | undefined) ?? null,
          url: (item.link as string | undefined) ?? null,
          publishedAt: rawTs ? toISO(new Date(rawTs * 1000)) : null,
          summary: null,
        };
      });
    } catch {
      return [];
    }
  }
}
