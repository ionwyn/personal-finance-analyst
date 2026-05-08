export type AssetType = "Stock" | "ETF" | "ADR" | "Mutual Fund" | "Other";
export type Currency = "CAD" | "USD";

export type InvestmentAccount = {
  id: string;
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
  status: "IDLE" | "SYNCING" | "ERROR";
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
  avgCost: number;
  mvNative: number;
  mvCAD: number;
  costNative: number;
  costCAD: number;
  plCAD: number;
  plPct: number;
  logoBg: string;
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
  fxUSDtoCAD: number;
};

export type InvestmentDashboardData = {
  summary: InvestmentSummary;
  accounts: InvestmentAccount[];
  holdings: InvestmentPosition[];
  cashBalances: InvestmentCashBalance[];
  allocByType: Allocation[];
  allocByCcy: Allocation[];
};
