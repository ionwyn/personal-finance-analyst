import YahooFinance from "yahoo-finance2";

import type {
  AnalystConsensus,
  DividendPayment,
  HistoricalDateRange,
  MarketDataProvider,
  MarketEvents,
  MarketQuote,
  NewsItem,
  PricePoint,
  SecurityFundamentals,
  SecurityProfile,
  SymbolSearchResult,
} from "../types";

// ─── Singleton client ─────────────────────────────────────────────────────
// One instance shared across all calls in the Node process.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const YAHOO_EXCHANGE_SUFFIXES = new Set(["V", "TO", "CN", "NE"]);

// ─── Symbol convention ────────────────────────────────────────────────────
// Yahoo uses a hyphen for share classes while SnapTrade commonly uses dots:
// BRK.B -> BRK-B and HPS.A.TO -> HPS-A.TO. A single multi-letter suffix is an
// exchange code and stays dotted (for example VFV.TO).
export function toYahooSymbol(symbol: string): string {
  const parts = symbol.toUpperCase().split(".");
  if (parts.length >= 3) {
    const exchange = parts.pop();
    return `${parts.join("-")}.${exchange}`;
  }
  if (parts.length === 2 && YAHOO_EXCHANGE_SUFFIXES.has(parts[1]!)) {
    return parts.join(".");
  }
  if (parts.length === 2 && parts[1]?.length === 1) {
    return parts.join("-");
  }
  return parts.join(".");
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
      const q = await yf.quote(toYahooSymbol(symbol));
      if (!q) return null;
      return {
        symbol,
        currency: (q as { currency?: string }).currency ?? "USD",
        price: safeNum((q as { regularMarketPrice?: number }).regularMarketPrice) ?? 0,
        change: safeNum((q as { regularMarketChange?: number }).regularMarketChange) ?? 0,
        changePct:
          safeNum((q as { regularMarketChangePercent?: number }).regularMarketChangePercent) ?? 0,
        open: safeNum((q as { regularMarketOpen?: number }).regularMarketOpen),
        prevClose: safeNum(
          (q as { regularMarketPreviousClose?: number }).regularMarketPreviousClose
        ),
        dayHigh: safeNum((q as { regularMarketDayHigh?: number }).regularMarketDayHigh),
        dayLow: safeNum((q as { regularMarketDayLow?: number }).regularMarketDayLow),
        high52w: safeNum((q as { fiftyTwoWeekHigh?: number }).fiftyTwoWeekHigh),
        low52w: safeNum((q as { fiftyTwoWeekLow?: number }).fiftyTwoWeekLow),
        volume: safeNum((q as { regularMarketVolume?: number }).regularMarketVolume),
        avgVolume: safeNum((q as { averageDailyVolume3Month?: number }).averageDailyVolume3Month),
        marketCap: safeNum((q as { marketCap?: number }).marketCap),
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getTimeSeries(symbol: string, days: number): Promise<PricePoint[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    return this.getTimeSeriesRange(symbol, { startDate, endDate });
  }

  async getTimeSeriesRange(symbol: string, range: HistoricalDateRange): Promise<PricePoint[]> {
    try {
      const period1 = new Date(`${range.startDate}T00:00:00.000Z`);
      const period2 = new Date(`${range.endDate}T00:00:00.000Z`);
      period2.setUTCDate(period2.getUTCDate() + 1);
      // Use chart() directly — historical() is deprecated in yahoo-finance2 v3.
      const result = await yf.chart(toYahooSymbol(symbol), {
        period1,
        period2,
        interval: "1d",
      });
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
      const s = await yf.quoteSummary(toYahooSymbol(symbol), {
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
        beta: safeNum(sd?.beta) ?? safeNum(ks?.beta),
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getProfile(symbol: string): Promise<SecurityProfile | null> {
    try {
      const s = await yf.quoteSummary(toYahooSymbol(symbol), { modules: ["assetProfile"] });
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
      const result = await yf.search(toYahooSymbol(symbol), {
        newsCount: count,
        quotesCount: 0,
      });
      const news = (result as { news?: unknown[] }).news ?? [];
      return news.slice(0, count).map((n) => {
        const item = n as Record<string, unknown>;
        const rawTs = item.providerPublishTime as number | undefined;
        const related = Array.isArray(item.relatedTickers)
          ? (item.relatedTickers as unknown[]).filter((t): t is string => typeof t === "string")
          : [];
        return {
          title: (item.title as string | undefined) ?? "",
          source: (item.publisher as string | undefined) ?? null,
          url: (item.link as string | undefined) ?? null,
          publishedAt: rawTs ? toISO(new Date(rawTs * 1000)) : null,
          summary: null,
          relatedTickers: related,
        };
      });
    } catch {
      return [];
    }
  }

  async getEvents(symbol: string): Promise<MarketEvents | null> {
    try {
      const s = await yf.quoteSummary(toYahooSymbol(symbol), { modules: ["calendarEvents"] });
      const c = s.calendarEvents as
        | {
            earnings?: { earningsDate?: Date[] };
            exDividendDate?: Date;
            dividendDate?: Date;
          }
        | undefined;
      if (!c) return null;
      const earnings = c.earnings?.earningsDate?.[0];
      const events: MarketEvents = {
        symbol,
        nextEarnings: toISO(earnings),
        exDividend: toISO(c.exDividendDate),
        dividendDate: toISO(c.dividendDate),
        fetchedAt: new Date().toISOString(),
      };
      // Return null when the calendar is entirely empty (common for ETFs).
      if (!events.nextEarnings && !events.exDividend && !events.dividendDate) return null;
      return events;
    } catch {
      return null;
    }
  }

  async getAnalyst(symbol: string): Promise<AnalystConsensus | null> {
    try {
      const s = await yf.quoteSummary(toYahooSymbol(symbol), {
        modules: ["financialData", "recommendationTrend"],
      });
      const fd = s.financialData as Record<string, unknown> | undefined;
      const trend = (
        s.recommendationTrend as { trend?: Record<string, unknown>[] } | undefined
      )?.trend?.find((t) => t.period === "0m");

      const consensus: AnalystConsensus = {
        symbol,
        targetLow: safeNum(fd?.targetLowPrice),
        targetMean: safeNum(fd?.targetMeanPrice),
        targetHigh: safeNum(fd?.targetHighPrice),
        analystCount: safeNum(fd?.numberOfAnalystOpinions),
        recKey: (fd?.recommendationKey as string | undefined) ?? null,
        recMean: safeNum(fd?.recommendationMean),
        strongBuy: safeNum(trend?.strongBuy),
        buy: safeNum(trend?.buy),
        hold: safeNum(trend?.hold),
        sell: safeNum(trend?.sell),
        strongSell: safeNum(trend?.strongSell),
        fetchedAt: new Date().toISOString(),
      };
      // No coverage at all (typical for ETFs) → null, not a row of dashes.
      if (consensus.targetMean == null && consensus.analystCount == null) return null;
      return consensus;
    } catch {
      return null;
    }
  }

  async getDividends(symbol: string, days: number): Promise<DividendPayment[]> {
    try {
      const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = (await yf.chart(toYahooSymbol(symbol), {
        period1,
        interval: "1mo",
        events: "div",
      })) as { events?: { dividends?: { date: Date; amount: number }[] } };
      const divs = result.events?.dividends ?? [];
      return divs
        .map((d) => ({ date: toDateStr(d.date) ?? "", amount: d.amount }))
        .filter((d) => d.date && Number.isFinite(d.amount) && d.amount > 0)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
    } catch {
      return [];
    }
  }

  async searchSymbols(query: string, count = 8): Promise<SymbolSearchResult[]> {
    try {
      const result = await yf.search(query, { quotesCount: count, newsCount: 0 });
      const quotes = (result as { quotes?: unknown[] }).quotes ?? [];
      return quotes
        .map((raw) => {
          const q = raw as Record<string, unknown>;
          const symbol = q.symbol as string | undefined;
          if (!symbol) return null;
          return {
            symbol,
            name: (q.longname as string | undefined) ?? (q.shortname as string | undefined) ?? null,
            exchange: (q.exchDisp as string | undefined) ?? null,
            type: (q.quoteType as string | undefined) ?? null,
          };
        })
        .filter((q): q is SymbolSearchResult => q != null);
    } catch {
      return [];
    }
  }
}
