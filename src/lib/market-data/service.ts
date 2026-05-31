import { prisma } from "@/lib/prisma";
import type {
  MarketDataProvider,
  MarketQuote,
  NewsItem,
  PricePoint,
  SecurityFundamentals,
  SecurityProfile,
} from "./types";

// ─── Cache TTLs ───────────────────────────────────────────────────────────
const TTL = {
  quote: 60 * 60 * 1000, // 1 hour  — prices
  profile: 7 * 24 * 60 * 60 * 1000, // 7 days  — sector/industry/fundamentals
  series: 4 * 60 * 60 * 1000, // 4 hours — add today's close when market closed
  news: 30 * 60 * 1000, // 30 min  — headlines
} as const;

function isStale(fetchedAt: Date, ttlMs: number): boolean {
  return Date.now() - fetchedAt.getTime() > ttlMs;
}

function n(v: { toNumber(): number } | number | null | undefined): number | null {
  if (v == null) return null;
  return typeof v === "number" ? v : v.toNumber();
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

// ─── Combined payload for the position page ───────────────────────────────

export type PositionMarketData = {
  quote: MarketQuote | null;
  profile: SecurityProfile | null;
  fundamentals: SecurityFundamentals | null;
  series: PricePoint[];
  news: NewsItem[];
  technicals: Technicals;
  periods: ReturnPeriod[];
};

// ─── Service ──────────────────────────────────────────────────────────────

export class MarketDataService {
  constructor(private readonly provider: MarketDataProvider) {}

  // ── Quote ────────────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const cached = await prisma.marketQuote.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, TTL.quote)) {
      return {
        symbol,
        currency: cached.currency ?? "USD",
        price: n(cached.price) ?? 0,
        change: n(cached.change) ?? 0,
        changePct: n(cached.changePct) ?? 0,
        open: n(cached.open),
        high52w: n(cached.high52w),
        low52w: n(cached.low52w),
        volume: cached.volume != null ? Number(cached.volume) : null,
        marketCap: n(cached.marketCap),
        fetchedAt: cached.fetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getQuote(symbol);
    if (fresh) await this.saveQuote(fresh);
    return fresh;
  }

  private async saveQuote(q: MarketQuote) {
    await prisma.marketQuote.upsert({
      where: { symbol: q.symbol },
      create: {
        symbol: q.symbol,
        currency: q.currency,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        open: q.open,
        high52w: q.high52w,
        low52w: q.low52w,
        volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
        marketCap: q.marketCap,
        fetchedAt: new Date(q.fetchedAt),
      },
      update: {
        currency: q.currency,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        open: q.open,
        high52w: q.high52w,
        low52w: q.low52w,
        volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
        marketCap: q.marketCap,
        fetchedAt: new Date(q.fetchedAt),
      },
    });
  }

  // ── Profile + Fundamentals (stored together in MarketProfile) ────────

  async getProfile(symbol: string): Promise<SecurityProfile | null> {
    const cached = await prisma.marketProfile.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, TTL.profile)) {
      return {
        symbol,
        name: cached.name,
        sector: cached.sector,
        industry: cached.industry,
        country: cached.country,
        description: cached.description,
        fetchedAt: cached.fetchedAt.toISOString(),
      };
    }
    const fresh = await this.provider.getProfile(symbol);
    if (fresh) await this.upsertProfile(symbol, { profile: fresh });
    return fresh;
  }

  async getFundamentals(symbol: string): Promise<SecurityFundamentals | null> {
    const cached = await prisma.marketProfile.findUnique({ where: { symbol } });
    if (cached && !isStale(cached.updatedAt, TTL.profile)) {
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
        fetchedAt: cached.fetchedAt.toISOString(),
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
        fetchedAt: now,
      },
      update: {
        ...(p != null && {
          name: p.name,
          sector: p.sector,
          industry: p.industry,
          country: p.country,
          description: p.description,
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
        }),
        fetchedAt: now,
      },
    });
  }

  // ── Time series ───────────────────────────────────────────────────────

  async getTimeSeries(symbol: string, days = 400): Promise<PricePoint[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = await prisma.marketPriceDay.findMany({
      where: { symbol, date: { gte: cutoff } },
      orderBy: { date: "asc" },
    });

    // Refresh if we have no data, or the newest entry is stale.
    const newest = rows.at(-1);
    const needsRefresh = !newest || isStale(newest.fetchedAt, TTL.series);
    if (needsRefresh) {
      const fresh = await this.provider.getTimeSeries(symbol, days);
      if (fresh.length > 0) {
        await this.saveTimeSeries(symbol, fresh);
        return fresh;
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
    await prisma.$transaction(
      points.map((p) =>
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
          },
          update: {
            close: p.close,
            open: p.open,
            high: p.high,
            low: p.low,
            volume: p.volume != null ? BigInt(Math.round(p.volume)) : null,
            fetchedAt: new Date(),
          },
        })
      )
    );
  }

  // ── News ─────────────────────────────────────────────────────────────

  async getNews(symbol: string, count = 6): Promise<NewsItem[]> {
    const cached = await prisma.marketNews.findMany({
      where: { symbol },
      orderBy: { publishedAt: "desc" },
      take: count,
    });
    const newest = cached[0];
    if (newest && !isStale(newest.fetchedAt, TTL.news)) {
      return cached.map((n) => ({
        title: n.title,
        source: n.source,
        url: n.url,
        publishedAt: n.publishedAt?.toISOString() ?? null,
        summary: n.summary,
      }));
    }
    const fresh = await this.provider.getNews(symbol, count);
    if (fresh.length > 0) await this.saveNews(symbol, fresh);
    return fresh;
  }

  private async saveNews(symbol: string, items: NewsItem[]) {
    // Replace all news for this symbol with the fresh batch.
    await prisma.$transaction([
      prisma.marketNews.deleteMany({ where: { symbol } }),
      prisma.marketNews.createMany({
        data: items.map((n) => ({
          symbol,
          title: n.title,
          source: n.source,
          url: n.url,
          summary: n.summary,
          publishedAt: n.publishedAt ? new Date(n.publishedAt) : null,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  // ── Combined fetch for the position page ─────────────────────────────

  async getPositionMarketData(symbol: string): Promise<PositionMarketData> {
    const [quote, profile, fundamentals, series, news] = await Promise.all([
      this.getQuote(symbol).catch(() => null),
      this.getProfile(symbol).catch(() => null),
      this.getFundamentals(symbol).catch(() => null),
      this.getTimeSeries(symbol, 400).catch(() => [] as PricePoint[]),
      this.getNews(symbol, 6).catch(() => [] as NewsItem[]),
    ]);
    return {
      quote,
      profile,
      fundamentals,
      series,
      news,
      technicals: computeTechnicals(series),
      periods: computePeriods(series),
    };
  }
}
