// Vala-Fi's graph is built from SEC filings, so it only covers US-listed
// issuers. Filtering before we spend quota keeps foreign listings (.TO/.V/.F),
// class-share dotted tickers and obvious fund symbols from burning the precious
// 10-unique-tickers/day budget. Mirrors the intel layer's `isUsListed`.

export function normalizeTicker(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** US common-share tickers: 1–6 letters/digits, no exchange suffix or dot.
 *  Excludes VFV.TO, BRK.B and the like — none resolve in Vala-Fi's graph. */
export function isLikelyUsListed(symbol: string): boolean {
  return /^[A-Z][A-Z0-9]{0,5}$/.test(normalizeTicker(symbol));
}

/** Heuristic for fund/ETF symbols we should never look up (cash, money-market,
 *  and common ETF families that aren't SEC issuers in the supply-chain sense). */
export function isLikelyFund(symbol: string, assetType?: string | null): boolean {
  if (assetType && /etf|fund|cash|crypto|currency/i.test(assetType)) return true;
  return false;
}

/** Whether it's worth spending quota on this symbol at all. */
export function isTrackable(symbol: string, assetType?: string | null): boolean {
  return isLikelyUsListed(symbol) && !isLikelyFund(symbol, assetType);
}
