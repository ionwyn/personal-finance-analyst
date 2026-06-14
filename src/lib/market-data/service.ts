import { prisma } from "@/lib/prisma";
import type {
  AnalystConsensus,
  DividendPayment,
  HistoricalDateRange,
  MarketDataProvider,
  MarketEvents,
  MarketQuote,
  NewsItem,
  NewsRelevance,
  NewsTag,
  PricePoint,
  RankedNewsItem,
  SecurityFundamentals,
  SecurityProfile,
  SymbolSearchResult,
} from "./types";

// ─── Cache TTLs ───────────────────────────────────────────────────────────
const TTL = {
  quote: 60 * 60 * 1000, // 1 hour  — prices
  profile: 7 * 24 * 60 * 60 * 1000, // 7 days  — sector/industry/fundamentals
  series: 4 * 60 * 60 * 1000, // 4 hours — add today's close when market closed
  news: 30 * 60 * 1000, // 30 min  — headlines
  events: 24 * 60 * 60 * 1000, // 24 hours — earnings/dividend dates
  analyst: 24 * 60 * 60 * 1000, // 24 hours — price targets & rec trend
  dividends: 7 * 24 * 60 * 60 * 1000, // 7 days — per-share payout history
} as const;

/** How far back dividend history is fetched (5 years). */
const DIVIDEND_LOOKBACK_DAYS = 5 * 365;
const SERIES_EDGE_TOLERANCE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function isStale(fetchedAt: Date, ttlMs: number): boolean {
  return Date.now() - fetchedAt.getTime() > ttlMs;
}

function n(v: { toNumber(): number } | number | null | undefined): number | null {
  if (v == null) return null;
  return typeof v === "number" ? v : v.toNumber();
}

function historicalDateTime(date: string): number {
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)) {
    throw new Error(`Invalid historical market date: ${date}`);
  }
  return time;
}

function datesWithin(left: string, right: string, days: number): boolean {
  return Math.abs(historicalDateTime(left) - historicalDateTime(right)) <= days * DAY_MS;
}

// ─── Computed technicals (from stored time series) ────────────────────────

export type Technicals = {
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
};

function computeTechnicals(series: PricePoint[]): Technicals {
  const closes = series.map((p) => p.close);
  const len = closes.length;

  const sma = (window: number): number | null => {
    if (len < window) return null;
    const slice = closes.slice(-window);
    return slice.reduce((s, v) => s + v, 0) / window;
  };

  const rsi14 = (): number | null => {
    if (len < 15) return null;
    const recent = closes.slice(-15);
    let gains = 0,
      losses = 0;
    for (let i = 1; i < 15; i++) {
      const d = recent[i] - recent[i - 1];
      if (d > 0) gains += d;
      else losses += -d;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  return { sma50: sma(50), sma200: sma(200), rsi14: rsi14() };
}

// ─── Return-by-period (computed from time series) ─────────────────────────

export type ReturnPeriod = {
  label: string;
  returnPct: number | null;
};

function computePeriods(series: PricePoint[]): ReturnPeriod[] {
  if (series.length === 0)
    return [
      { label: "1M", returnPct: null },
      { label: "3M", returnPct: null },
      { label: "6M", returnPct: null },
      { label: "YTD", returnPct: null },
      { label: "1Y", returnPct: null },
    ];

  const current = series.at(-1)!.close;
  const today = new Date();
  const ytdStart = `${today.getFullYear()}-01-01`;

  const closestBefore = (daysAgo: number): number | null => {
    const target = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // find the last entry on or before target date
    const candidates = series.filter((p) => p.date <= target);
    return candidates.at(-1)?.close ?? null;
  };

  const retPct = (base: number | null) =>
    base != null && base !== 0 ? ((current - base) / base) * 100 : null;

  return [
    { label: "1M", returnPct: retPct(closestBefore(30)) },
    { label: "3M", returnPct: retPct(closestBefore(91)) },
    { label: "6M", returnPct: retPct(closestBefore(182)) },
    {
      label: "YTD",
      returnPct: retPct(series.filter((p) => p.date <= ytdStart).at(-1)?.close ?? null),
    },
    { label: "1Y", returnPct: retPct(closestBefore(365)) },
  ];
}

// ─── News classification (deterministic — keyword rules, no AI) ───────────

function classifyTag(title: string): NewsTag {
  const t = title.toLowerCase();
  if (/\b(dividend|distribution|payout|yield)\b/.test(t)) return "DIVIDEND";
  if (
    /\b(upgrade|downgrade|price target|analyst|rating|overweight|underweight|outperform|buy rating)\b/.test(
      t
    )
  )
    return "ANALYST";
  if (/\b(earnings|revenue|eps|profit|guidance|quarter|q[1-4]\b|results)\b/.test(t))
    return "EARNINGS";
  if (/\b(lawsuit|antitrust|regulat|sec\b|probe|investigat|fine|settlement|subpoena)\b/.test(t))
    return "REGULATORY";
  if (/\b(acqui|merger|takeover|buyout|deal|stake|spinoff)\b/.test(t)) return "M&A";
  if (/\b(launch|unveil|product|release|chip|iphone|model|feature|rollout)\b/.test(t))
    return "PRODUCT";
  if (/\b(sector|industry|market|index|s&p|nasdaq|stocks)\b/.test(t)) return "SECTOR";
  return "NEWS";
}

// Normalise ticker shapes across providers (BRK-B vs BRK.B, VFV.TO).
function normTicker(s: string): string {
  return s.toUpperCase().replace(/[.\-]/g, "");
}

function scoreRelevance(symbol: string, related: string[]): NewsRelevance | null {
  const target = normTicker(symbol);
  const idx = related.findIndex((r) => normTicker(r) === target);
  if (idx === -1) return null; // ticker absent → noise, filter out
  if (related.length === 1 || idx === 0) return "high";
  if (related.length <= 4) return "med";
  return "low";
}

const RELEVANCE_WEIGHT: Record<NewsRelevance, number> = { high: 3, med: 2, low: 1 };

/** Classify, drop noise (ticker absent), and sort by relevance then recency. */
function rankNews(symbol: string, items: NewsItem[]): RankedNewsItem[] {
  const ranked: RankedNewsItem[] = [];
  for (const item of items) {
    const relevance = scoreRelevance(symbol, item.relatedTickers);
    if (relevance == null) continue; // filtered as irrelevant
    ranked.push({ ...item, tag: classifyTag(item.title), relevance });
  }
  ranked.sort((a, b) => {
    const w = RELEVANCE_WEIGHT[b.relevance] - RELEVANCE_WEIGHT[a.relevance];
    if (w !== 0) return w;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
  return ranked;
}

// ─── Combined payload for the position page ───────────────────────────────

export type PositionMarketData = {
  quote: MarketQuote | null;
  profile: SecurityProfile | null;
  fundamentals: SecurityFundamentals | null;
  series: PricePoint[];
  news: RankedNewsItem[];
  events: MarketEvents | null;
  analyst: AnalystConsensus | null;
  dividends: DividendPayment[];
  technicals: Technicals;
  periods: ReturnPeriod[];
};

// ─── Service ──────────────────────────────────────────────────────────────

export class MarketDataService {
  constructor(private readonly provider: MarketDataProvider) {}

  // ── Quote ────────────────────────────────────────────────────────────

  async getQuote(symbol: string, maxAgeMs: number = TTL.quote): Promise<MarketQuote | null> {
    const cached = await prisma.marketQuote.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, maxAgeMs)) {
      return {
        symbol,
        currency: cached.currency ?? "USD",
        price: n(cached.price) ?? 0,
        change: n(cached.change) ?? 0,
        changePct: n(cached.changePct) ?? 0,
        open: n(cached.open),
        prevClose: n(cached.prevClose),
        dayHigh: n(cached.dayHigh),
        dayLow: n(cached.dayLow),
        high52w: n(cached.high52w),
        low52w: n(cached.low52w),
        volume: cached.volume != null ? Number(cached.volume) : null,
        avgVolume: cached.avgVolume != null ? Number(cached.avgVolume) : null,
        marketCap: n(cached.marketCap),
        fetchedAt: cached.fetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getQuote(symbol);
    if (fresh) await this.saveQuote(fresh);
    return fresh;
  }

  /** Batched getQuote — preserves input order; null for symbols that fail. */
  async getQuotes(
    symbols: string[],
    maxAgeMs: number = TTL.quote
  ): Promise<(MarketQuote | null)[]> {
    return Promise.all(symbols.map((s) => this.getQuote(s, maxAgeMs).catch(() => null)));
  }

  private async saveQuote(q: MarketQuote) {
    const data = {
      currency: q.currency,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      open: q.open,
      prevClose: q.prevClose,
      dayHigh: q.dayHigh,
      dayLow: q.dayLow,
      high52w: q.high52w,
      low52w: q.low52w,
      volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
      avgVolume: q.avgVolume != null ? BigInt(Math.round(q.avgVolume)) : null,
      marketCap: q.marketCap,
      fetchedAt: new Date(q.fetchedAt),
    };
    await prisma.marketQuote.upsert({
      where: { symbol: q.symbol },
      create: { symbol: q.symbol, ...data },
      update: data,
    });
  }

  // ── Profile + Fundamentals (stored together in MarketProfile) ────────

  async getProfile(symbol: string): Promise<SecurityProfile | null> {
    const cached = await prisma.marketProfile.findUnique({ where: { symbol } });
    if (cached?.profileFetchedAt && !isStale(cached.profileFetchedAt, TTL.profile)) {
      return {
        symbol,
        name: cached.name,
        sector: cached.sector,
        industry: cached.industry,
        country: cached.country,
        description: cached.description,
        fetchedAt: cached.profileFetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getProfile(symbol);
    if (fresh) await this.upsertProfile(symbol, { profile: fresh });
    return fresh;
  }

  async getFundamentals(symbol: string): Promise<SecurityFundamentals | null> {
    const cached = await prisma.marketProfile.findUnique({ where: { symbol } });
    if (cached?.fundamentalsFetchedAt && !isStale(cached.fundamentalsFetchedAt, TTL.profile)) {
      return {
        symbol,
        isFund: cached.isFund,
        peRatio: n(cached.peRatio),
        forwardPe: n(cached.forwardPe),
        pbRatio: n(cached.pbRatio),
        evEbitda: n(cached.evEbitda),
        revenueGrowthPct: n(cached.revenueGrowthPct),
        epsGrowthPct: n(cached.epsGrowthPct),
        grossMarginPct: n(cached.grossMarginPct),
        operatingMarginPct: n(cached.operatingMarginPct),
        freeCashFlow: n(cached.freeCashFlow),
        dividendYieldPct: n(cached.dividendYieldPct),
        expenseRatioPct: n(cached.expenseRatioPct),
        aum: n(cached.aum),
        holdingsCount: cached.holdingsCount,
        beta: n(cached.beta),
        fetchedAt: cached.fundamentalsFetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getFundamentals(symbol);
    if (fresh) await this.upsertProfile(symbol, { fundamentals: fresh });
    return fresh;
  }

  private async upsertProfile(
    symbol: string,
    data: { profile?: SecurityProfile | null; fundamentals?: SecurityFundamentals | null }
  ) {
    const p = data.profile;
    const f = data.fundamentals;
    const now = new Date();
    await prisma.marketProfile.upsert({
      where: { symbol },
      create: {
        symbol,
        name: p?.name ?? null,
        sector: p?.sector ?? null,
        industry: p?.industry ?? null,
        country: p?.country ?? null,
        description: p?.description ?? null,
        isFund: f?.isFund ?? false,
        peRatio: f?.peRatio,
        forwardPe: f?.forwardPe,
        pbRatio: f?.pbRatio,
        evEbitda: f?.evEbitda,
        revenueGrowthPct: f?.revenueGrowthPct,
        epsGrowthPct: f?.epsGrowthPct,
        grossMarginPct: f?.grossMarginPct,
        operatingMarginPct: f?.operatingMarginPct,
        freeCashFlow: f?.freeCashFlow,
        dividendYieldPct: f?.dividendYieldPct,
        expenseRatioPct: f?.expenseRatioPct,
        aum: f?.aum,
        holdingsCount: f?.holdingsCount,
        beta: f?.beta,
        fetchedAt: now,
        profileFetchedAt: p ? now : null,
        fundamentalsFetchedAt: f ? now : null,
      },
      update: {
        ...(p != null && {
          name: p.name,
          sector: p.sector,
          industry: p.industry,
          country: p.country,
          description: p.description,
          profileFetchedAt: now,
        }),
        ...(f != null && {
          isFund: f.isFund,
          peRatio: f.peRatio,
          forwardPe: f.forwardPe,
          pbRatio: f.pbRatio,
          evEbitda: f.evEbitda,
          revenueGrowthPct: f.revenueGrowthPct,
          epsGrowthPct: f.epsGrowthPct,
          grossMarginPct: f.grossMarginPct,
          operatingMarginPct: f.operatingMarginPct,
          freeCashFlow: f.freeCashFlow,
          dividendYieldPct: f.dividendYieldPct,
          expenseRatioPct: f.expenseRatioPct,
          aum: f.aum,
          holdingsCount: f.holdingsCount,
          beta: f.beta,
          fundamentalsFetchedAt: now,
        }),
        fetchedAt: now,
      },
    });
  }

  // ── Time series ───────────────────────────────────────────────────────

  async getTimeSeries(symbol: string, days = 400): Promise<PricePoint[]> {
    const startDate = new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    return this.getTimeSeriesRange(symbol, { startDate, endDate });
  }

  async getTimeSeriesRange(symbol: string, range: HistoricalDateRange): Promise<PricePoint[]> {
    historicalDateTime(range.startDate);
    historicalDateTime(range.endDate);
    if (range.endDate < range.startDate) {
      throw new Error("Historical market end date must not precede start date");
    }

    const loadRows = () =>
      prisma.marketPriceDay.findMany({
        where: {
          symbol,
          date: { gte: range.startDate, lte: range.endDate },
        },
        orderBy: { date: "asc" },
      });
    let rows = await loadRows();

    const oldest = rows[0];
    const newest = rows.at(-1);
    const coversStart =
      oldest && datesWithin(oldest.date, range.startDate, SERIES_EDGE_TOLERANCE_DAYS);
    const coversEnd = newest && datesWithin(newest.date, range.endDate, SERIES_EDGE_TOLERANCE_DAYS);
    const needsRefresh =
      !coversStart || !coversEnd || !newest || isStale(newest.fetchedAt, TTL.series);
    if (needsRefresh) {
      const fresh = await this.provider.getTimeSeriesRange(symbol, range);
      if (fresh.length > 0) {
        await this.saveTimeSeries(symbol, fresh);
        rows = await loadRows();
      }
    }

    return rows.map((r) => ({
      date: r.date,
      close: n(r.close)!,
      open: n(r.open),
      high: n(r.high),
      low: n(r.low),
      volume: r.volume != null ? Number(r.volume) : null,
    }));
  }

  private async saveTimeSeries(symbol: string, points: PricePoint[]) {
    if (points.length === 0) return;
    const fetchedAt = new Date();
    for (let offset = 0; offset < points.length; offset += 250) {
      const batch = points.slice(offset, offset + 250);
      await prisma.$transaction(
        batch.map((p) =>
          prisma.marketPriceDay.upsert({
            where: { symbol_date: { symbol, date: p.date } },
            create: {
              symbol,
              date: p.date,
              close: p.close,
              open: p.open,
              high: p.high,
              low: p.low,
              volume: p.volume != null ? BigInt(Math.round(p.volume)) : null,
              fetchedAt,
            },
            update: {
              close: p.close,
              open: p.open,
              high: p.high,
              low: p.low,
              volume: p.volume != null ? BigInt(Math.round(p.volume)) : null,
              fetchedAt,
            },
          })
        )
      );
    }
  }

  // ── News (classified + relevance-ranked) ─────────────────────────────

  async getNews(symbol: string, count = 6): Promise<RankedNewsItem[]> {
    const cached = await prisma.marketNews.findMany({
      where: { symbol },
      orderBy: { publishedAt: "desc" },
    });
    const newest = cached[0];
    if (newest && !isStale(newest.fetchedAt, TTL.news)) {
      // Stored rows are already filtered & classified — just re-rank and cap.
      const items: RankedNewsItem[] = cached.map((c) => ({
        title: c.title,
        source: c.source,
        url: c.url,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        summary: c.summary,
        relatedTickers: [],
        tag: (c.tag as RankedNewsItem["tag"]) ?? "NEWS",
        relevance: (c.relevance as RankedNewsItem["relevance"]) ?? "low",
      }));
      const weight: Record<string, number> = { high: 3, med: 2, low: 1 };
      items.sort((a, b) => {
        const w = (weight[b.relevance] ?? 0) - (weight[a.relevance] ?? 0);
        if (w !== 0) return w;
        return Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0");
      });
      return items.slice(0, count);
    }
    // Fetch extra so relevance filtering still leaves a full set.
    const fresh = await this.provider.getNews(symbol, count * 3);
    const ranked = rankNews(symbol, fresh).slice(0, count);
    if (ranked.length > 0) await this.saveNews(symbol, ranked);
    return ranked;
  }

  private async saveNews(symbol: string, items: RankedNewsItem[]) {
    // Replace all news for this symbol with the fresh, ranked batch.
    await prisma.$transaction([
      prisma.marketNews.deleteMany({ where: { symbol } }),
      prisma.marketNews.createMany({
        data: items.map((n) => ({
          symbol,
          title: n.title,
          source: n.source,
          url: n.url,
          summary: n.summary,
          tag: n.tag,
          relevance: n.relevance,
          publishedAt: n.publishedAt ? new Date(n.publishedAt) : null,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  // ── Events (earnings / dividend calendar) ────────────────────────────

  async getEvents(symbol: string): Promise<MarketEvents | null> {
    const cached = await prisma.marketEvents.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, TTL.events)) {
      return {
        symbol,
        nextEarnings: cached.nextEarnings?.toISOString() ?? null,
        exDividend: cached.exDividend?.toISOString() ?? null,
        dividendDate: cached.dividendDate?.toISOString() ?? null,
        fetchedAt: cached.fetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getEvents(symbol);
    if (fresh) {
      await prisma.marketEvents.upsert({
        where: { symbol },
        create: {
          symbol,
          nextEarnings: fresh.nextEarnings ? new Date(fresh.nextEarnings) : null,
          exDividend: fresh.exDividend ? new Date(fresh.exDividend) : null,
          dividendDate: fresh.dividendDate ? new Date(fresh.dividendDate) : null,
          fetchedAt: new Date(fresh.fetchedAt),
        },
        update: {
          nextEarnings: fresh.nextEarnings ? new Date(fresh.nextEarnings) : null,
          exDividend: fresh.exDividend ? new Date(fresh.exDividend) : null,
          dividendDate: fresh.dividendDate ? new Date(fresh.dividendDate) : null,
          fetchedAt: new Date(fresh.fetchedAt),
        },
      });
    }
    return fresh;
  }

  // ── Analyst consensus ─────────────────────────────────────────────────

  async getAnalyst(symbol: string): Promise<AnalystConsensus | null> {
    const cached = await prisma.marketAnalyst.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, TTL.analyst)) {
      return {
        symbol,
        targetLow: n(cached.targetLow),
        targetMean: n(cached.targetMean),
        targetHigh: n(cached.targetHigh),
        analystCount: cached.analystCount,
        recKey: cached.recKey,
        recMean: n(cached.recMean),
        strongBuy: cached.strongBuy,
        buy: cached.buy,
        hold: cached.hold,
        sell: cached.sell,
        strongSell: cached.strongSell,
        fetchedAt: cached.fetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getAnalyst(symbol);
    if (fresh) {
      const data = {
        targetLow: fresh.targetLow,
        targetMean: fresh.targetMean,
        targetHigh: fresh.targetHigh,
        analystCount: fresh.analystCount,
        recKey: fresh.recKey,
        recMean: fresh.recMean,
        strongBuy: fresh.strongBuy,
        buy: fresh.buy,
        hold: fresh.hold,
        sell: fresh.sell,
        strongSell: fresh.strongSell,
        fetchedAt: new Date(fresh.fetchedAt),
      };
      await prisma.marketAnalyst.upsert({
        where: { symbol },
        create: { symbol, ...data },
        update: data,
      });
    }
    return fresh;
  }

  // ── Dividend history ──────────────────────────────────────────────────

  async getDividends(symbol: string): Promise<DividendPayment[]> {
    const cached = await prisma.marketDividend.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
    });
    const newest = cached.at(-1);
    if (newest && !isStale(newest.fetchedAt, TTL.dividends)) {
      return cached.map((d) => ({ date: d.date, amount: n(d.amount)! }));
    }
    const fresh = await this.provider.getDividends(symbol, DIVIDEND_LOOKBACK_DAYS);
    if (fresh.length > 0) {
      await prisma.$transaction([
        prisma.marketDividend.deleteMany({ where: { symbol } }),
        prisma.marketDividend.createMany({
          data: fresh.map((d) => ({ symbol, date: d.date, amount: d.amount })),
          skipDuplicates: true,
        }),
      ]);
      return fresh;
    }
    return cached.map((d) => ({ date: d.date, amount: n(d.amount)! }));
  }

  // ── Symbol search (typeahead — no cache, user-initiated) ──────────────

  async searchSymbols(query: string, count = 8): Promise<SymbolSearchResult[]> {
    return this.provider.searchSymbols(query, count);
  }

  // ── Combined fetch for the position page ─────────────────────────────

  async getPositionMarketData(symbol: string): Promise<PositionMarketData> {
    const [quote, profile, fundamentals, series, news, events, analyst, dividends] =
      await Promise.all([
        this.getQuote(symbol).catch(() => null),
        this.getProfile(symbol).catch(() => null),
        this.getFundamentals(symbol).catch(() => null),
        this.getTimeSeries(symbol, 400).catch(() => [] as PricePoint[]),
        this.getNews(symbol, 6).catch(() => [] as RankedNewsItem[]),
        this.getEvents(symbol).catch(() => null),
        this.getAnalyst(symbol).catch(() => null),
        this.getDividends(symbol).catch(() => [] as DividendPayment[]),
      ]);
    return {
      quote,
      profile,
      fundamentals,
      series,
      news,
      events,
      analyst,
      dividends,
      technicals: computeTechnicals(series),
      periods: computePeriods(series),
    };
  }
}
