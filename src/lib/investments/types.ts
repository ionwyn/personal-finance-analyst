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
  totalValue: number;
  cash: number;
  openedAt: string | null;
  lastSyncAt: string | null;
  positionCount: number;
  status: "IDLE" | "SYNCING" | "ERROR" | "DISABLED";
  isStale: boolean;
  initialSyncComplete: boolean;
};

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
