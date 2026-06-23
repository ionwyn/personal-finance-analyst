import { prisma } from "@/lib/prisma";
import { getMarketDataService } from "@/lib/market-data";
import { groupOf } from "./activity-types";
import { loadSymbolIntel } from "./intel-loader";
import { loadInvestments } from "./loader";
import type { PositionActivityRow, PositionDetail, PositionLot } from "./types";
import { toNullableNumber } from "./shared/decimal";

const FUND_TYPES = new Set(["ETF", "MUTUAL FUND", "CEF", "FUND"]);

function isFundType(type: string) {
  return FUND_TYPES.has(type.toUpperCase());
}

function sinceLabel(openedAt: string | null): string | null {
  if (!openedAt) return null;
  const d = new Date(openedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function normalizeLedgerSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\.TO$/, "").replace(/\.VN$/, "");
}

function canonicalDisplayType(entry: { activityType: string; activitySubType: string | null }) {
  if (entry.activityType === "Trade") return entry.activitySubType ?? "TRADE";
  if (entry.activityType === "Dividend") return "DIVIDEND";
  if (entry.activityType === "StockDividend") return "STOCK_DIVIDEND";
  if (entry.activityType === "Interest") return "INTEREST";
  if (entry.activityType === "Fee") return entry.activitySubType === "TAX" ? "TAX" : "FEE";
  return entry.activitySubType ?? entry.activityType.toUpperCase();
}

/**
 * Build the single-holding "position" view for a symbol, aggregated across every
 * account that holds it. Everything here is derived from the SnapTrade sync in
 * Postgres — no external market-data calls (those are a later phase).
 */
export async function getPositionDetail(
  tenantId: string | null | undefined,
  rawSymbol: string
): Promise<PositionDetail | null> {
  if (!tenantId) return null;
  const symbol = decodeURIComponent(rawSymbol).trim();
  if (!symbol) return null;

  const { accounts, holdings, cashBalances, fxUSDtoCAD } = await loadInvestments(tenantId);

  // Lots for this symbol (case-insensitive), largest first.
  const lotsRaw = holdings
    .filter((h) => h.symbol.toLowerCase() === symbol.toLowerCase())
    .sort((a, b) => b.mvCAD - a.mvCAD);
  if (lotsRaw.length === 0) return null;

  const base = lotsRaw[0];
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // ── portfolio-level aggregates (for weight, rank, currency share, P&L share) ──
  const bySymbolMv = new Map<string, number>();
  for (const h of holdings) {
    bySymbolMv.set(h.symbol, (bySymbolMv.get(h.symbol) ?? 0) + h.mvCAD);
  }
  const rankedSymbols = [...bySymbolMv.entries()].sort((a, b) => b[1] - a[1]);
  const rank = rankedSymbols.findIndex(([s]) => s === base.symbol) + 1;
  const holdingsMv = holdings.reduce((s, h) => s + h.mvCAD, 0);
  const cashCad = cashBalances.reduce((s, c) => s + c.valueCAD, 0);
  const portfolioCad = holdingsMv + cashCad;
  const totalPl = holdings.reduce((s, h) => s + (h.plCAD ?? 0), 0);
  const usdMv = holdings
    .filter((h) => h.currency.toUpperCase() === "USD")
    .reduce((s, h) => s + h.mvCAD, 0);
  const usdShare = holdingsMv > 0 ? (usdMv / holdingsMv) * 100 : 0;

  // ── this position's own aggregates ──
  const lots: PositionLot[] = lotsRaw.map((h) => {
    const acct = accountById.get(h.accountId);
    const openedAt = acct?.openedAt ?? null;
    return {
      accountId: h.accountId,
      accountLabel: acct?.registration ?? "ACCOUNT",
      institution: acct?.institution ?? "Brokerage",
      institutionLogo: acct?.institutionLogo ?? null,
      institutionLogoBg: acct?.institutionLogoBg ?? "#1f3a93",
      institutionLogoText: acct?.institutionLogoText ?? "ST",
      currency: h.currency,
      units: h.units,
      avg: h.avgCost,
      costNative: h.costNative,
      costCad: h.costCAD,
      mvNative: h.mvNative,
      mvCad: h.mvCAD,
      uplCad: h.plCAD,
      uplPct: h.plPct,
      weight: 0, // filled below once we know the position total
      openedAt,
      since: sinceLabel(openedAt),
    };
  });

  const totalUnits = lots.reduce((s, l) => s + l.units, 0);
  const mvNative = lotsRaw.reduce((s, h) => s + h.mvNative, 0);
  const mvCad = lotsRaw.reduce((s, h) => s + h.mvCAD, 0);
  const costNative = lots.some((l) => l.costNative != null)
    ? lots.reduce((s, l) => s + (l.costNative ?? 0), 0)
    : null;
  const costCad = lots.some((l) => l.costCad != null)
    ? lots.reduce((s, l) => s + (l.costCad ?? 0), 0)
    : null;
  const uplCad = costCad == null ? null : lots.reduce((s, l) => s + (l.uplCad ?? 0), 0);
  const uplPct = costCad && costCad !== 0 && uplCad != null ? (uplCad / costCad) * 100 : null;
  const avgNative = costNative != null && totalUnits > 0 ? costNative / totalUnits : null;
  const weight = portfolioCad > 0 ? (mvCad / portfolioCad) * 100 : 0;
  for (const l of lots) l.weight = mvCad > 0 ? (l.mvCad / mvCad) * 100 : 0;

  // ── activity for this symbol ──
  const activityRaw = await prisma.brokerLedgerEntry.findMany({
    where: {
      tenantId,
      account: { is: { tracked: true } },
      symbolNorm: normalizeLedgerSymbol(base.symbol),
    },
    orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
    include: { account: true },
    take: 250,
  });

  const activity: PositionActivityRow[] = activityRaw.map((a) => {
    const acct = a.accountId ? accountById.get(a.accountId) : undefined;
    const type = canonicalDisplayType(a);
    const amountNative = a.nativeCashAmount?.negated().toNumber() ?? null;
    const amountCad = a.cashAmount?.negated().toNumber() ?? null;
    const isTax = a.activityType === "Fee" && a.activitySubType === "TAX";
    const fee =
      a.activityType === "Fee" && !isTax && a.cashAmount?.isPositive()
        ? a.cashAmount.toNumber()
        : 0;
    const tax = isTax && a.cashAmount?.isPositive() ? a.cashAmount.toNumber() : 0;
    return {
      id: a.id,
      type,
      group: groupOf(type),
      accountLabel: acct?.registration ?? (a.account?.accountCategory ?? "ACCT").toUpperCase(),
      description: a.name,
      units: a.units.isZero() ? null : a.units.toNumber(),
      price: toNullableNumber(a.unitPrice),
      amountNative,
      amountCad,
      fee,
      tax,
      currency: a.nativeCurrency ?? "CAD",
      fxRate: toNullableNumber(a.fxRate),
      tradeDate: a.tradeDate.toISOString(),
    };
  });

  // ── performance roll-up ──
  const dividendRows = activity.filter((a) => a.group === "income" && (a.amountCad ?? 0) > 0);
  const dividendsCad = dividendRows.reduce((s, a) => s + (a.amountCad ?? 0), 0);
  const feesCad = activity.reduce((s, a) => s + a.fee, 0);
  const taxesCad = activity.reduce((s, a) => s + a.tax, 0);
  const totalReturnCad = uplCad == null ? null : uplCad + dividendsCad - feesCad - taxesCad;
  const totalReturnPct =
    totalReturnCad != null && costCad && costCad !== 0 ? (totalReturnCad / costCad) * 100 : null;

  const lastSync = accounts.reduce<string | null>((acc, a) => {
    if (!a.lastSyncAt) return acc;
    if (!acc) return a.lastSyncAt;
    return a.lastSyncAt > acc ? a.lastSyncAt : acc;
  }, null);
  const now = Date.now();
  const syncTs = lastSync ? new Date(lastSync).getTime() : NaN;
  const syncIsFresh = Number.isFinite(syncTs) && now - syncTs < 24 * 60 * 60 * 1000;

  const openedTimes = lots
    .map((l) => (l.openedAt ? new Date(l.openedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  const oldestOpened = openedTimes.length ? Math.min(...openedTimes) : null;
  const holdLabel =
    oldestOpened != null ? ((now - oldestOpened) / 3.156e10).toFixed(1) + " yrs" : null;

  return {
    symbol: base.symbol,
    name: base.description,
    type: base.type,
    isFund: isFundType(base.type),
    exchange: base.exchange,
    currency: base.currency,
    logoBg: base.logoBg,
    logoId: base.logoId,
    price: base.price,
    fxUSDtoCAD,
    totalUnits,
    avgNative,
    costNative,
    costCad,
    mvNative,
    mvCad,
    uplCad,
    uplPct,
    weight,
    lots,
    activity,
    performance: {
      openPlCad: uplCad,
      openPlPct: uplPct,
      realizedCad: null,
      dividendsCad,
      dividendCount: dividendRows.length,
      feesCad,
      taxesCad,
      totalReturnCad,
      totalReturnPct,
    },
    exposure: {
      weight,
      currencyShare: base.currency.toUpperCase() === "USD" ? usdShare : 100 - usdShare,
      currencyShareDelta: holdingsMv > 0 ? (mvCad / holdingsMv) * 100 : 0,
      contribPnlPct: totalPl > 0 && uplCad != null ? Math.max(0, (uplCad / totalPl) * 100) : 0,
      rank: rank > 0 ? rank : 1,
      count: rankedSymbols.length,
    },
    lastSync,
    syncIsFresh,
    holdLabel,
    ...(await marketAndIntel(base.symbol, isFundType(base.type))),
  };
}

async function marketAndIntel(symbol: string, isFund: boolean) {
  const [marketData, intel] = await Promise.all([
    getMarketDataService()
      .getPositionMarketData(symbol)
      .catch(() => null),
    loadSymbolIntel(symbol, { isFund }).catch(() => null),
  ]);
  return { marketData, intel };
}
