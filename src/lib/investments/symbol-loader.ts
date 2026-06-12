import { getMarketDataService, type PositionMarketData } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";

import { loadSymbolIntel, type SymbolIntelBundle } from "./intel-loader";

// ─── Market-only symbol view (not held in any account) ─────────────────────
// Backs /app/investments/[symbol] when getPositionDetail finds no lots, so
// any watchlist or searched ticker gets a research page.

export type SymbolDetail = {
  symbol: string;
  name: string | null;
  currency: string;
  isFund: boolean;
  onWatchlist: boolean;
  marketData: PositionMarketData;
  intel: SymbolIntelBundle | null;
};

export async function getSymbolDetail(
  tenantId: string | null | undefined,
  rawSymbol: string
): Promise<SymbolDetail | null> {
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();
  if (!symbol) return null;

  const svc = getMarketDataService();
  const [marketData, watch] = await Promise.all([
    svc.getPositionMarketData(symbol).catch(() => null),
    tenantId
      ? prisma.watchlistItem.findUnique({
          where: { tenantId_symbol: { tenantId, symbol } },
        })
      : Promise.resolve(null),
  ]);

  // No quote at all → unknown ticker → let the page 404.
  if (!marketData?.quote) return null;

  // Name: watchlist (captured at add time) → profile → typeahead lookup.
  let name = watch?.name ?? marketData.profile?.name ?? null;
  if (!name) {
    const results = await svc.searchSymbols(symbol, 3).catch(() => []);
    const norm = (s: string) => s.toUpperCase().replace(/[.\-]/g, "");
    name = results.find((r) => norm(r.symbol) === norm(symbol))?.name ?? null;
  }

  // Heuristic: funds report AUM / expense ratio but no sector profile.
  const f = marketData.fundamentals;
  const isFund = Boolean(f && f.aum != null && marketData.profile?.sector == null);

  return {
    symbol,
    name,
    currency: marketData.quote.currency,
    isFund,
    onWatchlist: watch != null,
    marketData,
    intel: await loadSymbolIntel(symbol, { isFund }).catch(() => null),
  };
}
