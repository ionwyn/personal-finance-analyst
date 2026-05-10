import type {
  Account,
  Balance,
  BrokerageAuthorization,
  Position,
  UniversalSymbol
} from "snaptrade-typescript-sdk";

import { normalizeSnapTradeLogoUrl } from "@/lib/snaptrade/logo";

export type NormalizedConnection = {
  snapTradeAuthorizationId: string;
  name: string | null;
  type: string | null;
  brokerageName: string | null;
  brokerageSlug: string | null;
  disabled: boolean;
  disabledAt: Date | null;
};

export type NormalizedAccount = {
  snapTradeAccountId: string;
  name: string;
  institutionName: string | null;
  rawType: string | null;
  accountCategory: string | null;
  currency: string | null;
  totalValue: number | null;
  openedAt: Date | null;
  snapTradeCreatedAt: Date | null;
  status: string | null;
  isPaper: boolean;
  lastHoldingsSyncAt: Date | null;
  holdingsInitialSyncComplete: boolean;
};

export type NormalizedBalance = {
  currency: string;
  cash: number;
  buyingPower: number | null;
};

export type NormalizedPosition = {
  snapTradeSymbolId: string | null;
  symbol: string;
  rawSymbol: string | null;
  description: string | null;
  assetType: string;
  exchange: string | null;
  currency: string;
  units: number;
  price: number | null;
  avgCost: number | null;
  marketValueNative: number;
  costNative: number | null;
  pnlNative: number | null;
  pnlPct: number | null;
  cashEquivalent: boolean;
  logoUrl: string | null;
};

export function isClosedSnapTradeAccountStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "closed" || normalized === "account_closed";
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function upperCurrency(value: unknown) {
  const code = stringOrNull(value);
  return code ? code.toUpperCase() : null;
}

function normalizeAssetType(symbol: UniversalSymbol | undefined) {
  const code = symbol?.type?.code?.toLowerCase();
  switch (code) {
    case "ad":
      return "ADR";
    case "bnd":
      return "Bond";
    case "cef":
      return "CEF";
    case "crypto":
      return "Crypto";
    case "cs":
      return "Stock";
    case "et":
      return "ETF";
    case "mf":
    case "oef":
      return "Mutual Fund";
    default:
      return symbol?.type?.description ?? "Other";
  }
}

export function normalizeConnection(authorization: BrokerageAuthorization): NormalizedConnection | null {
  if (!authorization.id) return null;
  return {
    snapTradeAuthorizationId: authorization.id,
    name: authorization.name ?? null,
    type: authorization.type ?? null,
    brokerageName: authorization.brokerage?.display_name ?? authorization.brokerage?.name ?? null,
    brokerageSlug: authorization.brokerage?.slug ?? null,
    disabled: Boolean(authorization.disabled),
    disabledAt: dateOrNull(authorization.disabled_date)
  };
}

export function normalizeAccount(account: Account): NormalizedAccount {
  const holdingsStatus = account.sync_status?.holdings;
  return {
    snapTradeAccountId: account.id,
    name: account.name ?? account.institution_name ?? "Brokerage account",
    institutionName: account.institution_name ?? null,
    rawType: account.raw_type ?? null,
    accountCategory: account.account_category ?? null,
    currency: upperCurrency(account.balance?.total?.currency ?? account.meta?.currency),
    totalValue: numberOrNull(account.balance?.total?.amount),
    openedAt: dateOrNull(account.opening_date),
    snapTradeCreatedAt: dateOrNull(account.created_date),
    status: account.status ?? null,
    isPaper: Boolean(account.is_paper),
    lastHoldingsSyncAt: dateOrNull(holdingsStatus?.last_successful_sync),
    holdingsInitialSyncComplete: Boolean(holdingsStatus?.initial_sync_completed)
  };
}

export function normalizeBalance(balance: Balance): NormalizedBalance | null {
  const currency = upperCurrency(balance.currency?.code);
  if (!currency) return null;
  return {
    currency,
    cash: numberOrNull(balance.cash) ?? 0,
    buyingPower: numberOrNull(balance.buying_power)
  };
}

export function normalizePosition(position: Position, index = 0): NormalizedPosition | null {
  const positionSymbol = position.symbol;
  const symbol = positionSymbol?.symbol as (UniversalSymbol & { logo_url?: string }) | undefined;
  const ticker = stringOrNull(symbol?.symbol ?? positionSymbol?.description);
  const units = numberOrNull(position.units);
  if (!ticker || units == null) return null;

  const price = numberOrNull(position.price);
  const avgCost = numberOrNull(position.average_purchase_price);
  const currency = upperCurrency(position.currency?.code ?? symbol?.currency?.code) ?? "CAD";
  const marketValueNative = units * (price ?? 0);
  const costNative = avgCost == null ? null : units * avgCost;
  const pnlNative = costNative == null ? null : marketValueNative - costNative;
  const pnlPct = costNative && pnlNative != null ? (pnlNative / costNative) * 100 : null;

  return {
    snapTradeSymbolId: symbol?.id ?? positionSymbol?.id ?? `position-${index}`,
    symbol: ticker,
    rawSymbol: symbol?.raw_symbol ?? null,
    description: symbol?.description ?? positionSymbol?.description ?? null,
    assetType: normalizeAssetType(symbol),
    exchange: symbol?.exchange?.mic_code ?? symbol?.exchange?.code ?? null,
    currency,
    units,
    price,
    avgCost,
    marketValueNative,
    costNative,
    pnlNative,
    pnlPct,
    cashEquivalent: Boolean(position.cash_equivalent),
    logoUrl: normalizeSnapTradeLogoUrl(symbol?.logo_url)
  };
}
