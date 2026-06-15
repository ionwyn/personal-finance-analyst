import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Maps SnapTrade uppercased activity types to the canonical BrokerLedgerEntry taxonomy
// used by the performance engine. Only CONTRIBUTION and WITHDRAWAL become MoneyMovement/EFT
// (external flows); everything else is cash-only or unit-affecting but not a flow.
const TYPE_MAP: Record<string, { activityType: string; activitySubType: string | null }> = {
  BUY: { activityType: "Trade", activitySubType: "BUY" },
  SELL: { activityType: "Trade", activitySubType: "SELL" },
  DIVIDEND: { activityType: "Dividend", activitySubType: null },
  REI: { activityType: "Dividend", activitySubType: null },
  INTEREST: { activityType: "Interest", activitySubType: null },
  STOCK_DIVIDEND: { activityType: "StockDividend", activitySubType: null },
  CONTRIBUTION: { activityType: "MoneyMovement", activitySubType: "EFT" },
  WITHDRAWAL: { activityType: "MoneyMovement", activitySubType: "EFT" },
  TRANSFER: { activityType: "MoneyMovement", activitySubType: "TRANSFER_TF" },
  EXTERNAL_ASSET_TRANSFER_IN: { activityType: "InternalSecurityTransfer", activitySubType: null },
  EXTERNAL_ASSET_TRANSFER_OUT: { activityType: "InternalSecurityTransfer", activitySubType: null },
  FEE: { activityType: "Fee", activitySubType: null },
  TAX: { activityType: "Fee", activitySubType: null },
  SPLIT: { activityType: "LegacyCorporateAction", activitySubType: "SPLIT" },
  ADJUSTMENT: { activityType: "Fee", activitySubType: null },
};

// In-kind transfers carry units but no cash (at household level they net to zero).
const NO_CASH_TYPES = new Set(["InternalSecurityTransfer"]);

function dedupeKey(tenantId: string, snapTradeActivityId: string): string {
  return createHash("sha256")
    .update(["snaptrade-v1", tenantId, snapTradeActivityId].join("\0"))
    .digest("hex");
}

function normalizeSymbol(symbol: string | null | undefined): string | null {
  const s = symbol?.trim().toUpperCase() ?? "";
  return s ? s.replace(/\.TO$/, "") : null;
}

// Appends SnapTrade activities for one account into BrokerLedgerEntry, starting strictly
// after the latest trade date already in the ledger for that account. Skips the account
// entirely if it has no existing ledger rows (= not part of the canonical investment scope).
// Idempotent: uses a SnapTrade-namespaced dedupeKey so re-runs produce no duplicates and
// never collide with CSV-imported entries which use a different namespace.
export async function appendToLedger(tenantId: string, accountId: string): Promise<number> {
  const latestEntry = await prisma.brokerLedgerEntry.findFirst({
    where: { tenantId, accountId },
    orderBy: { tradeDate: "desc" },
    select: { tradeDate: true },
  });
  if (!latestEntry) return 0;

  const cutoff = latestEntry.tradeDate;

  const activities = await prisma.snapTradeActivity.findMany({
    where: { tenantId, accountId, tradeDate: { gt: cutoff } },
    orderBy: [{ tradeDate: "asc" }],
    include: {
      account: { select: { snapTradeAccountId: true, rawType: true } },
    },
  });
  if (activities.length === 0) return 0;

  const account = activities[0]!.account;

  let count = 0;
  for (const activity of activities) {
    if (!activity.tradeDate) continue;

    const mapped = TYPE_MAP[activity.type];
    if (!mapped) continue;

    const symbol = normalizeSymbol(activity.symbol);
    const cashAmount = NO_CASH_TYPES.has(mapped.activityType)
      ? null
      : activity.amount != null
        ? activity.amount.negated()
        : null;

    const entry = {
      tenantId,
      accountId,
      accountExternalId: account.snapTradeAccountId,
      accountType: account.rawType ?? "Unknown",
      tradeDate: activity.tradeDate,
      settlementDate: activity.settlementDate,
      activityType: mapped.activityType,
      activitySubType: mapped.activitySubType,
      symbol: activity.symbol,
      symbolNorm: symbol,
      name: activity.description,
      currency: activity.currency,
      units: activity.units ?? new Prisma.Decimal(0),
      unitPrice: activity.price,
      cashAmount,
      dedupeKey: dedupeKey(tenantId, activity.snapTradeActivityId),
      raw: (activity.raw ?? null) as Prisma.InputJsonValue,
    };

    await prisma.brokerLedgerEntry.upsert({
      where: { dedupeKey: entry.dedupeKey },
      create: entry,
      update: {
        activityType: entry.activityType,
        activitySubType: entry.activitySubType,
        symbol: entry.symbol,
        symbolNorm: entry.symbolNorm,
        units: entry.units,
        unitPrice: entry.unitPrice,
        cashAmount: entry.cashAmount,
        raw: entry.raw,
      },
    });
    count += 1;
  }

  return count;
}
