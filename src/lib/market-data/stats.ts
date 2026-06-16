import { AsyncLocalStorage } from "node:async_hooks";

export type MarketDataCacheKind =
  | "quote"
  | "profile"
  | "fundamentals"
  | "series"
  | "news"
  | "events"
  | "analyst"
  | "dividends";

export type MarketDataCacheEvent = "hit" | "miss" | "stale" | "providerFetch";

export type MarketDataStats = Record<MarketDataCacheKind, Record<MarketDataCacheEvent, number>>;

const KINDS: MarketDataCacheKind[] = [
  "quote",
  "profile",
  "fundamentals",
  "series",
  "news",
  "events",
  "analyst",
  "dividends",
];

const EVENTS: MarketDataCacheEvent[] = ["hit", "miss", "stale", "providerFetch"];

const storage = new AsyncLocalStorage<MarketDataStats>();

export function emptyMarketDataStats(): MarketDataStats {
  return Object.fromEntries(
    KINDS.map((kind) => [kind, Object.fromEntries(EVENTS.map((event) => [event, 0]))])
  ) as MarketDataStats;
}

export function recordMarketDataCache(kind: MarketDataCacheKind, event: MarketDataCacheEvent) {
  const stats = storage.getStore();
  if (!stats) return;
  stats[kind][event] += 1;
}

export async function withMarketDataStats<T>(
  fn: () => Promise<T>
): Promise<{ result: T; stats: MarketDataStats }> {
  const stats = emptyMarketDataStats();
  const result = await storage.run(stats, fn);
  return { result, stats };
}
