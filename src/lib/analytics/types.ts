export type AccountSummary = {
  id: string;
  itemId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  availableBalance: number;
  currentBalance: number;
  isoCurrencyCode: string;
  lastBalanceAt: string | null;
  tracked: boolean;
  possibleDuplicate: boolean;
};

export type PlaidItemSummary = {
  id: string;
  institutionName: string;
  institutionId: string | null;
  institutionLogo: string | null;
  status: string;
  lastSyncAt: string | null;
  lastBalanceRefreshAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type InstitutionSummary = PlaidItemSummary & {
  total: number;
  accounts: AccountSummary[];
};

export type TransactionSummary = {
  id: string;
  name: string;
  rawName: string;
  amount: number;
  date: string;
  category: string;
  categoryColor: string;
  account: string;
  pending: boolean;
};

export type MonthlyCashflow = { month: string; income: number; spending: number; net: number };
export type CategorySpend = { category: string; amount: number; pct: number; color: string };
export type MerchantSpend = { merchant: string; amount: number };
export type BalancePoint = { date: string; balance: number };
