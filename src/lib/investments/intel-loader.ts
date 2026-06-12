import { getMarketDataService, getSymbolIntel, type SymbolIntel } from "@/lib/market-data";

// ─── Symbol intelligence bundle for position / symbol pages ────────────────
// getSymbolIntel covers the provider-cached datasets; this adds a peer
// comparison table priced from the regular quote cache (≤6 quote lookups,
// 1h TTL — the only market-data cost peers add).

export type PeerQuoteRow = {
  symbol: string;
  isSelf: boolean;
  price: number;
  changePct: number;
  marketCap: number | null;
  /** Position within the 52-week range, 0 (low) … 100 (high). */
  rangePos52w: number | null;
};

export type SymbolIntelBundle = SymbolIntel & { peerRows: PeerQuoteRow[] };

const MAX_PEERS = 6;

export async function loadSymbolIntel(
  symbol: string,
  opts?: { isFund?: boolean }
): Promise<SymbolIntelBundle> {
  const sym = symbol.toUpperCase();
  const intel = await getSymbolIntel(sym, opts);

  let peerRows: PeerQuoteRow[] = [];
  if (intel.peers.length > 0) {
    const tickers = [sym, ...intel.peers.slice(0, MAX_PEERS)];
    const quotes = await getMarketDataService().getQuotes(tickers);
    peerRows = tickers.flatMap((t, i) => {
      const q = quotes[i];
      if (!q) return [];
      const rangePos52w =
        q.low52w != null && q.high52w != null && q.high52w > q.low52w
          ? Math.max(0, Math.min(100, ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100))
          : null;
      return [
        {
          symbol: t,
          isSelf: t === sym,
          price: q.price,
          changePct: q.changePct,
          marketCap: q.marketCap,
          rangePos52w,
        },
      ];
    });
  }

  return { ...intel, peerRows };
}
