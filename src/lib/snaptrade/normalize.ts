import type {
  Account,
  AccountUniversalActivity,
  Balance,
  BrokerageAuthorization,
  Position,
  UniversalSymbol,
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
  unifiedAccountType: string | null;
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

export type NormalizedActivity = {
  snapTradeActivityId: string;
  type: string;
  symbol: string | null;
  description: string | null;
  units: number | null;
  price: number | null;
  amount: number | null;
  fee: number | null;
  currency: string;
  fxRate: number | null;
  tradeDate: Date | null;
  settlementDate: Date | null;
  externalReferenceId: string | null;
  institution: string | null;
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

// A coarse classification of a SnapTrade account, derived from its
// unifiedAccountType. `isLiability` accounts (credit cards, lines of credit)
// are debts whose balance must be paid down; their value subtracts from net
// worth. `isMargin` accounts are asset accounts that may carry a margin loan
// (reported by SnapTrade as a negative cash balance) — the account itself is
// not a liability but the loan portion is.
export type SnapTradeAccountKind =
  | "CREDIT_CARD"
  | "LINE_OF_CREDIT"
  | "MARGIN"
  | "CRYPTO"
  | "REGISTERED"
  | "CASH"
  | "INVESTMENT";

export type SnapTradeAccountClass = {
  kind: SnapTradeAccountKind;
  label: string;
  isLiability: boolean;
  isMargin: boolean;
};

const REGISTERED_TOKENS = ["TFSA", "RRSP", "FHSA", "RESP", "RRIF", "LIRA", "LRSP", "RDSP"];

export function classifySnapTradeAccount(
  unifiedAccountType: string | null | undefined,
  rawType: string | null | undefined
): SnapTradeAccountClass {
  const u = (unifiedAccountType ?? "").toUpperCase();
  const r = (rawType ?? "").toUpperCase();

  if (u.includes("CREDIT_CARD") || r === "CARD") {
    return { kind: "CREDIT_CARD", label: "CREDIT CARD", isLiability: true, isMargin: false };
  }
  if (u.includes("LINE_OF_CREDIT")) {
    return { kind: "LINE_OF_CREDIT", label: "LINE OF CREDIT", isLiability: true, isMargin: false };
  }
  if (u.includes("MARGIN")) {
    return { kind: "MARGIN", label: "MARGIN", isLiability: false, isMargin: true };
  }
  if (u.includes("CRYPTO") || r === "CRYPTO") {
    return { kind: "CRYPTO", label: "CRYPTO", isLiability: false, isMargin: false };
  }

  const registeredToken = REGISTERED_TOKENS.find((token) => u.includes(token) || r === token);
  if (registeredToken) {
    return { kind: "REGISTERED", label: registeredToken, isLiability: false, isMargin: false };
  }

  if (u.includes("HISA") || u.includes("SAVE") || u === "CASH" || u === "CASH_USD" || r === "MSB") {
    return { kind: "CASH", label: "CASH", isLiability: false, isMargin: false };
  }

  return {
    kind: "INVESTMENT",
    label: r || u || "BROKERAGE",
    isLiability: false,
    isMargin: false,
  };
}

export function isClosedSnapTradeAccountStatus(status: string | null | undefined) {
  const normalized = status
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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

type LogoBearing = {
  logo_url?: unknown;
  logoUrl?: unknown;
};

function positionLogoUrl(...sources: Array<LogoBearing | null | undefined>) {
  for (const source of sources) {
    const normalized = normalizeSnapTradeLogoUrl(source?.logo_url ?? source?.logoUrl);
    if (normalized) return normalized;
  }
  return null;
}

export function normalizeConnection(
  authorization: BrokerageAuthorization
): NormalizedConnection | null {
  if (!authorization.id) return null;
  return {
    snapTradeAuthorizationId: authorization.id,
    name: authorization.name ?? null,
    type: authorization.type ?? null,
    brokerageName: authorization.brokerage?.display_name ?? authorization.brokerage?.name ?? null,
    brokerageSlug: authorization.brokerage?.slug ?? null,
    disabled: Boolean(authorization.disabled),
    disabledAt: dateOrNull(authorization.disabled_date),
  };
}

export function normalizeAccount(account: Account): NormalizedAccount {
  const holdingsStatus = account.sync_status?.holdings;
  const meta = account.meta as Record<string, unknown> | undefined;
  return {
    snapTradeAccountId: account.id,
    name: account.name ?? account.institution_name ?? "Brokerage account",
    institutionName: account.institution_name ?? null,
    rawType: account.raw_type ?? null,
    accountCategory: account.account_category ?? null,
    unifiedAccountType: stringOrNull(meta?.unifiedAccountType ?? meta?.unified_account_type),
    currency: upperCurrency(account.balance?.total?.currency ?? account.meta?.currency),
    totalValue: numberOrNull(account.balance?.total?.amount),
    openedAt: dateOrNull(account.opening_date),
    snapTradeCreatedAt: dateOrNull(account.created_date),
    status: account.status ?? null,
    isPaper: Boolean(account.is_paper),
    lastHoldingsSyncAt: dateOrNull(holdingsStatus?.last_successful_sync),
    holdingsInitialSyncComplete: Boolean(holdingsStatus?.initial_sync_completed),
  };
}

export function normalizeBalance(balance: Balance): NormalizedBalance | null {
  const currency = upperCurrency(balance.currency?.code);
  if (!currency) return null;
  return {
    currency,
    cash: numberOrNull(balance.cash) ?? 0,
    buyingPower: numberOrNull(balance.buying_power),
  };
}

export function normalizeActivity(activity: AccountUniversalActivity): NormalizedActivity | null {
  if (!activity.id) return null;

  const activitySymbol = activity.symbol as
    | { symbol?: { symbol?: unknown }; description?: unknown }
    | null
    | undefined;
  const ticker =
    stringOrNull(activitySymbol?.symbol?.symbol) ??
    stringOrNull(activitySymbol?.description) ??
    null;

  const currency = upperCurrency(activity.currency?.code) ?? "CAD";

  return {
    snapTradeActivityId: activity.id,
    type: stringOrNull(activity.type)?.toUpperCase() ?? "UNKNOWN",
    symbol: ticker,
    description: stringOrNull(activity.description),
    units: numberOrNull(activity.units),
    price: numberOrNull(activity.price),
    amount: numberOrNull(activity.amount),
    fee: numberOrNull(activity.fee),
    currency,
    fxRate: numberOrNull(activity.fx_rate),
    tradeDate: dateOrNull(activity.trade_date),
    settlementDate: dateOrNull(activity.settlement_date),
    externalReferenceId: stringOrNull(activity.external_reference_id),
    institution: stringOrNull(activity.institution),
  };
}

export function normalizePosition(position: Position, index = 0): NormalizedPosition | null {
  const positionWithLogo = position as Position & LogoBearing;
  const positionSymbol = position.symbol as (Position["symbol"] & LogoBearing) | undefined;
  const symbol = positionSymbol?.symbol as (UniversalSymbol & LogoBearing) | undefined;
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
    logoUrl: positionLogoUrl(symbol, positionSymbol, positionWithLogo),
  };
}
