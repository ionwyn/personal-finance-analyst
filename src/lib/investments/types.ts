import type { ActivityGroupKey } from "./activity-types";
import type { PositionMarketData } from "@/lib/market-data";

export type AssetType = string;
export type Currency = string;

export type InvestmentAccount = {
  id: string;
  connectionId: string;
  name: string;
  registration: string;
  institution: string;
  institutionLogoBg: string;
  institutionLogoText: string;
  currency: Currency;
  // Signed net value of the account (holdings + cash). For a liability account
  // (credit card) carrying a balance this is negative.
  totalValue: number;
  cash: number;
  // Coarse account class derived from SnapTrade's unifiedAccountType.
  kind: AccountKind;
  // True for credit cards / lines of credit — debts to be paid down.
  isLiability: boolean;
  // True for margin accounts (asset accounts that may carry a margin loan).
  isMargin: boolean;
  // Debt owed on this account in CAD, as a positive number: the amount owed on
  // a credit card, or the margin loan (negative cash) on a margin account. 0
  // for ordinary asset accounts.
  liabilityCAD: number;
  openedAt: string | null;
  lastSyncAt: string | null;
  positionCount: number;
  status: "IDLE" | "SYNCING" | "ERROR" | "DISABLED";
  isStale: boolean;
  initialSyncComplete: boolean;
  // False when the user has untracked this account: excluded from holdings,
  // cash, and every total, but still listed so it can be re-tracked.
  tracked: boolean;
};

export type AccountKind =
  | "CREDIT_CARD"
  | "LINE_OF_CREDIT"
  | "MARGIN"
  | "CRYPTO"
  | "REGISTERED"
  | "CASH"
  | "INVESTMENT";

export type InvestmentConnection = {
  id: string;
  institution: string;
  institutionLogoBg: string;
  institutionLogoText: string;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  isStale: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  accountCount: number;
  initialSyncIncompleteCount: number;
};

export type InvestmentPosition = {
  id: string;
  accountId: string;
  symbol: string;
  description: string;
  type: AssetType;
  exchange: string;
  currency: Currency;
  units: number;
  price: number;
  avgCost: number | null;
  mvNative: number;
  mvCAD: number;
  costNative: number | null;
  costCAD: number | null;
  plCAD: number | null;
  plPct: number | null;
  logoBg: string;
  logoId: string | null;
};

export type InvestmentCashBalance = {
  currency: Currency;
  value: number;
  valueCAD: number;
  buyingPower: number;
};

export type Allocation = {
  name: string;
  value: number;
  pct: number;
  color: string;
};

export type ConnectionStatus = "IDLE" | "SYNCING" | "ERROR" | "DISABLED";

export type InvestmentSummary = {
  institution: string;
  institutionLogoBg: string;
  institutionLogoText: string;
  accountCount: number;
  positionCount: number;
  portfolioCAD: number;
  // Total assets (investment holdings + positive cash) in CAD.
  assetsCAD: number;
  // Total debt (credit card balances + margin loans + any negative cash) in
  // CAD, as a positive number.
  liabilitiesCAD: number;
  // Net worth across linked accounts = assetsCAD − liabilitiesCAD.
  netWorthCAD: number;
  costCAD: number;
  plCAD: number;
  plPct: number;
  cashCAD: number;
  cashByCcy: InvestmentCashBalance[];
  lastSync: string | null;
  fxUSDtoCAD: number | null;
  omittedPositionCount: number;
  status: ConnectionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  connectionCount: number;
  failingConnectionCount: number;
};

export type InvestmentDashboardData = {
  summary: InvestmentSummary;
  accounts: InvestmentAccount[];
  connections: InvestmentConnection[];
  holdings: InvestmentPosition[];
  cashBalances: InvestmentCashBalance[];
  allocByType: Allocation[];
  allocByCcy: Allocation[];
};

// ─── Position detail page (single holding drill-down) ──────────────────────

// One brokerage account in which the symbol is held (the design calls these "lots").
export type PositionLot = {
  accountId: string;
  accountLabel: string; // registration, e.g. TFSA / RRSP
  institution: string;
  institutionLogoBg: string;
  institutionLogoText: string;
  currency: Currency;
  units: number;
  avg: number | null; // avg cost, native
  costNative: number | null;
  costCad: number | null;
  mvNative: number;
  mvCad: number;
  uplCad: number | null;
  uplPct: number | null;
  weight: number; // % of this position's market value
  openedAt: string | null;
  since: string | null; // "May 2024"
};

export type PositionActivityRow = {
  id: string;
  type: string;
  group: ActivityGroupKey;
  accountLabel: string;
  description: string | null;
  units: number | null;
  price: number | null;
  amountNative: number | null;
  amountCad: number | null;
  fee: number;
  currency: string;
  fxRate: number | null;
  tradeDate: string | null;
};

export type PositionPerformance = {
  openPlCad: number | null;
  openPlPct: number | null;
  realizedCad: number | null; // null in Phase 1 — needs lot matching
  dividendsCad: number;
  dividendCount: number;
  feesCad: number;
  totalReturnCad: number | null;
  totalReturnPct: number | null;
};

export type PositionExposure = {
  weight: number; // portfolio weight %
  currencyShare: number; // % of holdings in this currency
  currencyShareDelta: number; // pts this position contributes
  contribPnlPct: number; // contribution to total open P&L
  rank: number;
  count: number;
};

export type PositionDetail = {
  symbol: string;
  name: string;
  type: AssetType;
  isFund: boolean;
  exchange: string;
  currency: Currency;
  logoBg: string;
  logoId: string | null;
  price: number; // last price, native
  fxUSDtoCAD: number | null;
  totalUnits: number;
  avgNative: number | null;
  costNative: number | null;
  costCad: number | null;
  mvNative: number;
  mvCad: number;
  uplCad: number | null;
  uplPct: number | null;
  weight: number;
  lots: PositionLot[];
  activity: PositionActivityRow[];
  performance: PositionPerformance;
  exposure: PositionExposure;
  lastSync: string | null;
  syncIsFresh: boolean;
  holdLabel: string | null; // longest holding duration, e.g. "2.3 yrs"
  marketData: PositionMarketData | null;
};
