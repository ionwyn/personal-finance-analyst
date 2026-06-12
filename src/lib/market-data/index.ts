// ─── Public surface of the market-data module ─────────────────────────────
// All app code imports from here. To swap the provider (e.g. move off Yahoo
// Finance), change the import below and update the instantiation — nothing
// else in the codebase needs to change.

import { YahooFinanceProvider } from "./providers/yahoo";
import { MarketDataService } from "./service";

export type { MarketDataProvider } from "./types";
export type {
  AnalystConsensus,
  DividendPayment,
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
export type { PositionMarketData, ReturnPeriod, Technicals } from "./service";
export type { MacroGroup, MacroIndicator, YieldCurveData, YieldCurvePoint } from "./macro";
export { getMacroOverview, getYieldCurve } from "./macro";
export { getCanadaMacro } from "./statcan";
export type {
  AnnualFinancials,
  EarningsQuarter,
  InsiderTx,
  RecTrendMonth,
  SecFiling,
  SymbolIntel,
} from "./intel";
export {
  getEarningsHistory,
  getFilings,
  getFinancials,
  getInsiderTxs,
  getPeers,
  getRecTrends,
  getSymbolIntel,
  isUsListed,
} from "./intel";

// ─── Singleton ────────────────────────────────────────────────────────────
// In Next.js (Node.js runtime), this module is evaluated once per worker
// process — the singleton survives across requests within that process.

let _service: MarketDataService | null = null;

export function getMarketDataService(): MarketDataService {
  if (!_service) {
    _service = new MarketDataService(new YahooFinanceProvider());
  }
  return _service;
}
