import { createHash } from "node:crypto";

import {
  BrokerLedgerIngestionMode,
  BrokerLedgerProvider,
  BrokerLedgerReconciliationStatus,
  BrokerLedgerSourceStatus,
  Prisma,
  SyncRunStatus,
  type BrokerLedgerEntry,
  type SnapTradeActivity,
} from "@prisma/client";

import { getHistoricalUsdCad } from "@/lib/market-data";
import { prisma } from "@/lib/prisma";
import { classifySnapTradeAccount } from "@/lib/snaptrade/normalize";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_TOLERANCE_DAYS = 3;
const CASH_TOLERANCE = new Prisma.Decimal("0.02");
const UNIT_TOLERANCE = new Prisma.Decimal("0.00000001");

type CanonicalType = {
  activityType: string;
  activitySubType: string | null;
};

export type CanonicalCandidate = CanonicalType & {
  tradeDate: Date;
  settlementDate: Date | null;
  symbol: string | null;
  symbolNorm: string | null;
  name: string | null;
  currency: string | null;
  units: Prisma.Decimal;
  unitPrice: Prisma.Decimal | null;
  nativeCashAmount: Prisma.Decimal | null;
  nativeCurrency: string | null;
  cashAmount: Prisma.Decimal | null;
  fxRate: Prisma.Decimal | null;
};

type SourceActivity = SnapTradeActivity & {
  account: {
    snapTradeAccountId: string;
    rawType: string | null;
    unifiedAccountType: string | null;
    tracked: boolean;
  };
};

export type LedgerIngestionResult = {
  runId: string;
  sourceCount: number;
  insertedCount: number;
  linkedCount: number;
  canonicalizedCount: number;
  ignoredCount: number;
  conflictCount: number;
};

const TYPE_MAP: Record<string, CanonicalType> = {
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
  TAX: { activityType: "Fee", activitySubType: "TAX" },
  REIMBURSEMENT: {
    activityType: "AdministrativePayment",
    activitySubType: "MANAGEMENT_FEE_REFUND",
  },
  SPLIT: { activityType: "LegacyCorporateAction", activitySubType: "SPLIT" },
  ADJUSTMENT: { activityType: "Fee", activitySubType: null },
};

export function canonicalTypeForSnapTrade(type: string): CanonicalType | null {
  return TYPE_MAP[type] ?? null;
}

function sourceKey(activityId: string): string {
  return activityId;
}

function canonicalDedupeKey(tenantId: string, activityId: string): string {
  return createHash("sha256")
    .update(["snaptrade-canonical-v2", tenantId, activityId].join("\0"))
    .digest("hex");
}

function phaseFiveDedupeKey(tenantId: string, activityId: string): string {
  return createHash("sha256")
    .update(["snaptrade-v1", tenantId, activityId].join("\0"))
    .digest("hex");
}

function dateOnly(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dayDifference(left: Date, right: Date): number {
  return Math.abs(dateOnly(left).getTime() - dateOnly(right).getTime()) / DAY_MS;
}

function businessDayDifference(left: Date, right: Date): number {
  let start = dateOnly(left);
  let end = dateOnly(right);
  if (start > end) [start, end] = [end, start];
  let days = 0;
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

function normalizeSymbol(value: string | null | undefined): string | null {
  const raw = value?.trim().toUpperCase() ?? "";
  if (!raw) return null;
  const withoutExchange = raw.replace(/\.TO$/, "").replace(/\.VN$/, "");
  return withoutExchange === "ABR.V" ? "ABR" : withoutExchange;
}

function rawObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rawString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractSnapTradeTicker(
  raw: Prisma.JsonValue | null,
  description: string | null
): string | null {
  const root = rawObject(raw);
  const security = rawObject((root?.symbol as Prisma.JsonValue | null) ?? null);
  const structured =
    rawString(security?.symbol) ??
    rawString(security?.raw_symbol) ??
    rawString(root?.option_symbol);
  if (structured) return normalizeSymbol(structured);

  const text = description ?? "";
  const match =
    text.match(/\b(?:of|from)\s+([A-Z][A-Z0-9.-]*)(?:\s+at|$)/i) ??
    text.match(/\b([A-Z][A-Z0-9.-]*\.(?:TO|VN))\b/i);
  return normalizeSymbol(match?.[1] ?? null);
}

function eligibleAccount(unifiedAccountType: string | null, rawType: string | null): boolean {
  const kind = classifySnapTradeAccount(unifiedAccountType, rawType).kind;
  return kind === "REGISTERED" || kind === "MARGIN" || kind === "CRYPTO" || kind === "INVESTMENT";
}

function amountClose(
  left: Prisma.Decimal | null,
  right: Prisma.Decimal | null,
  tolerance = CASH_TOLERANCE
): boolean {
  if (left == null || right == null) return false;
  return left.abs().sub(right.abs()).abs().lte(tolerance);
}

function amountDistance(
  entryAmount: Prisma.Decimal | null,
  ...candidateAmounts: Array<Prisma.Decimal | null>
): Prisma.Decimal | null {
  if (entryAmount == null) return null;
  const distances = candidateAmounts
    .filter((amount): amount is Prisma.Decimal => amount != null)
    .map((amount) => entryAmount.abs().sub(amount.abs()).abs());
  return distances.length ? Prisma.Decimal.min(...distances) : null;
}

function unitsClose(left: Prisma.Decimal, right: Prisma.Decimal): boolean {
  return left.abs().sub(right.abs()).abs().lte(UNIT_TOLERANCE);
}

function priceClose(left: Prisma.Decimal | null, right: Prisma.Decimal | null): boolean {
  if (left == null || right == null) return false;
  const tolerance = Prisma.Decimal.max(
    CASH_TOLERANCE,
    right.abs().mul(new Prisma.Decimal("0.002"))
  );
  return left.sub(right).abs().lte(tolerance);
}

function eventFamily(type: CanonicalType): string {
  if (type.activityType === "Trade") return `Trade/${type.activitySubType}`;
  if (type.activityType === "Fee") return `Fee/${type.activitySubType ?? ""}`;
  if (type.activityType === "MoneyMovement") return `MoneyMovement/${type.activitySubType}`;
  return `${type.activityType}/${type.activitySubType ?? ""}`;
}

function existingFamily(entry: BrokerLedgerEntry): string {
  return eventFamily({
    activityType: entry.activityType,
    activitySubType: entry.activitySubType,
  });
}

function sourceCash(activity: SnapTradeActivity): Prisma.Decimal | null {
  return activity.amount == null ? null : activity.amount.negated();
}

async function cadCash(
  activity: SnapTradeActivity
): Promise<{ cash: Prisma.Decimal | null; fxRate: Prisma.Decimal | null }> {
  const native = sourceCash(activity);
  if (native == null) return { cash: null, fxRate: null };
  const currency = activity.currency.trim().toUpperCase();
  if (currency === "CAD") {
    return { cash: native, fxRate: new Prisma.Decimal(1) };
  }
  if (currency !== "USD" || !activity.tradeDate) {
    throw new Error(`Unsupported cash currency ${activity.currency}`);
  }
  if (activity.fxRate != null && activity.fxRate.gt(0)) {
    return { cash: native.mul(activity.fxRate), fxRate: activity.fxRate };
  }
  const date = activity.tradeDate.toISOString().slice(0, 10);
  const points = await getHistoricalUsdCad({ startDate: date, endDate: date });
  const point = points.at(-1);
  if (!point) throw new Error(`USD/CAD is unavailable for ${date}`);
  const fxRate = new Prisma.Decimal(point.rate);
  return { cash: native.mul(fxRate), fxRate };
}

function signedUnits(activity: SnapTradeActivity): Prisma.Decimal {
  const units = activity.units ?? new Prisma.Decimal(0);
  if (activity.type === "BUY" || activity.type === "EXTERNAL_ASSET_TRANSFER_IN") {
    return units.abs();
  }
  if (activity.type === "SELL" || activity.type === "EXTERNAL_ASSET_TRANSFER_OUT") {
    return units.abs().negated();
  }
  return units;
}

function transferPairs(activities: SourceActivity[]): Set<string> {
  const pairs = new Set<string>();
  const cash = activities
    .filter(
      (activity) =>
        (activity.type === "CONTRIBUTION" || activity.type === "WITHDRAWAL") &&
        activity.amount != null &&
        activity.tradeDate != null
    )
    .sort(
      (left, right) =>
        left.tradeDate!.getTime() - right.tradeDate!.getTime() ||
        left.snapTradeActivityId.localeCompare(right.snapTradeActivityId)
    );

  for (const contribution of cash.filter((activity) => activity.type === "CONTRIBUTION")) {
    if (pairs.has(contribution.id)) continue;
    const candidates = cash.filter(
      (activity) =>
        activity.type === "WITHDRAWAL" &&
        !pairs.has(activity.id) &&
        activity.accountId !== contribution.accountId &&
        dayDifference(activity.tradeDate!, contribution.tradeDate!) <= 1 &&
        amountClose(activity.amount, contribution.amount)
    );
    if (candidates.length !== 1) continue;
    pairs.add(contribution.id);
    pairs.add(candidates[0]!.id);
  }
  return pairs;
}

async function normalizedCandidate(
  activity: SourceActivity,
  pairedTransfers: Set<string>
): Promise<CanonicalCandidate | null> {
  const mapped = canonicalTypeForSnapTrade(activity.type);
  if (!mapped || !activity.tradeDate) return null;
  const type =
    pairedTransfers.has(activity.id) &&
    (activity.type === "CONTRIBUTION" || activity.type === "WITHDRAWAL")
      ? { activityType: "MoneyMovement", activitySubType: "TRANSFER_TF" }
      : mapped;
  const ticker = extractSnapTradeTicker(activity.raw, activity.description);
  const nativeCashAmount =
    type.activityType === "InternalSecurityTransfer" ? null : sourceCash(activity);
  const converted =
    type.activityType === "InternalSecurityTransfer"
      ? { cash: null, fxRate: null }
      : await cadCash(activity);
  const root = rawObject(activity.raw);
  const security = rawObject((root?.symbol as Prisma.JsonValue | null) ?? null);
  const keepsSecurity =
    type.activityType === "Trade" ||
    type.activityType === "Dividend" ||
    type.activityType === "StockDividend" ||
    type.activityType === "InternalSecurityTransfer" ||
    type.activityType === "LegacyCorporateAction" ||
    (type.activityType === "Fee" && type.activitySubType === "TAX");

  return {
    ...type,
    tradeDate: dateOnly(activity.tradeDate),
    settlementDate: activity.settlementDate ? dateOnly(activity.settlementDate) : null,
    symbol: keepsSecurity ? (rawString(security?.symbol) ?? ticker) : null,
    symbolNorm: keepsSecurity ? ticker : null,
    name: rawString(security?.description) ?? activity.symbol ?? activity.description,
    currency: activity.currency,
    units: signedUnits(activity),
    unitPrice: activity.price,
    nativeCashAmount,
    nativeCurrency: activity.currency,
    cashAmount: converted.cash,
    fxRate: converted.fxRate,
  };
}

function candidateScore(entry: BrokerLedgerEntry, candidate: CanonicalCandidate): number | null {
  const familyMatches =
    existingFamily(entry) === eventFamily(candidate) ||
    (candidate.activityType === "MoneyMovement" &&
      entry.activityType === "MoneyMovement" &&
      new Set([entry.activitySubType, candidate.activitySubType]).has("EFT") &&
      new Set([entry.activitySubType, candidate.activitySubType]).has("TRANSFER_TF"));
  if (!familyMatches) return null;
  const dateDelta = dayDifference(entry.tradeDate, candidate.tradeDate);
  if (businessDayDifference(entry.tradeDate, candidate.tradeDate) > DATE_TOLERANCE_DAYS) {
    return null;
  }

  let score = 100 - dateDelta * 10;
  if (candidate.symbolNorm != null) {
    if (normalizeSymbol(entry.symbolNorm) !== candidate.symbolNorm) return null;
    score += 40;
  }

  if (candidate.activityType === "Trade" || candidate.activityType === "InternalSecurityTransfer") {
    if (!unitsClose(entry.units, candidate.units)) return null;
    score += 50;
    if (priceClose(entry.unitPrice, candidate.unitPrice)) score += 15;
    if (amountClose(entry.cashAmount, candidate.cashAmount)) score += 15;
  } else if (candidate.activityType === "Dividend") {
    if (amountClose(entry.cashAmount, candidate.cashAmount)) score += 20;
  } else if (
    candidate.activityType === "Fee" ||
    candidate.activityType === "Interest" ||
    candidate.activityType === "AdministrativePayment" ||
    candidate.activityType === "MoneyMovement"
  ) {
    const distance = amountDistance(
      entry.cashAmount,
      candidate.cashAmount,
      candidate.nativeCashAmount
    );
    if (distance == null || distance.gt(CASH_TOLERANCE)) return null;
    score += 40 + Math.max(0, 20 - distance.toNumber() * 100);
  }
  return score;
}

function economicKey(entry: BrokerLedgerEntry): string {
  return [
    dateOnly(entry.tradeDate).toISOString(),
    existingFamily(entry),
    normalizeSymbol(entry.symbolNorm) ?? "",
    entry.units.toString(),
    entry.unitPrice?.toString() ?? "",
    entry.cashAmount?.toString() ?? "",
  ].join("\0");
}

export function bestLedgerMatch(
  entries: BrokerLedgerEntry[],
  candidate: CanonicalCandidate,
  usedEntryIds: Set<string>
): { entry: BrokerLedgerEntry | null; confidence: Prisma.Decimal | null; conflict: string | null } {
  const scored = entries
    .filter((entry) => !usedEntryIds.has(entry.id))
    .map((entry) => ({ entry, score: candidateScore(entry, candidate) }))
    .filter((item): item is { entry: BrokerLedgerEntry; score: number } => item.score != null)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
  if (scored.length === 0) return { entry: null, confidence: null, conflict: null };
  if (scored.length > 1 && scored[0]!.score === scored[1]!.score) {
    const tied = scored.filter((item) => item.score === scored[0]!.score);
    if (new Set(tied.map((item) => economicKey(item.entry))).size === 1) {
      const winner = tied[0]!;
      return {
        entry: winner.entry,
        confidence: new Prisma.Decimal(Math.min(1, winner.score / 220).toFixed(4)),
        conflict: null,
      };
    }
    return {
      entry: null,
      confidence: null,
      conflict: `Ambiguous match between ${scored.length} canonical events`,
    };
  }
  const winner = scored[0]!;
  return {
    entry: winner.entry,
    confidence: new Prisma.Decimal(Math.min(1, winner.score / 220).toFixed(4)),
    conflict: null,
  };
}

export async function refreshBrokerLedgerCoverage(tenantId: string, accountIds: string[]) {
  for (const accountId of accountIds) {
    const [dates, snapTradeCoverage] = await Promise.all([
      prisma.brokerLedgerEntry.aggregate({
        where: { tenantId, accountId },
        _min: { tradeDate: true },
        _max: { tradeDate: true },
      }),
      prisma.brokerLedgerSourceRecord.aggregate({
        where: {
          tenantId,
          accountId,
          provider: BrokerLedgerProvider.SNAPTRADE,
          status: { in: [BrokerLedgerSourceStatus.LINKED, BrokerLedgerSourceStatus.CONFLICT] },
        },
        _min: { tradeDate: true },
      }),
    ]);
    const conflictCount = await prisma.brokerLedgerSourceRecord.count({
      where: { tenantId, accountId, status: BrokerLedgerSourceStatus.CONFLICT },
    });
    await prisma.brokerLedgerCoverage.upsert({
      where: { accountId },
      create: {
        tenantId,
        accountId,
        activityStartDate: dates._min.tradeDate,
        activityEndDate: dates._max.tradeDate,
        taxCoverageStartDate: snapTradeCoverage._min.tradeDate,
        reconciliationStatus:
          conflictCount === 0
            ? BrokerLedgerReconciliationStatus.COMPLETE
            : BrokerLedgerReconciliationStatus.CONFLICT,
        canonicalizedAt: new Date(),
      },
      update: {
        activityStartDate: dates._min.tradeDate,
        activityEndDate: dates._max.tradeDate,
        taxCoverageStartDate: snapTradeCoverage._min.tradeDate,
        reconciliationStatus:
          conflictCount === 0
            ? BrokerLedgerReconciliationStatus.COMPLETE
            : BrokerLedgerReconciliationStatus.CONFLICT,
        canonicalizedAt: new Date(),
      },
    });
  }
}

export async function canonicalizeSnapTradeActivities(
  tenantId: string,
  options: {
    accountIds?: string[];
    mode?: BrokerLedgerIngestionMode;
  } = {}
): Promise<LedgerIngestionResult> {
  const run = await prisma.brokerLedgerIngestionRun.create({
    data: {
      tenantId,
      provider: BrokerLedgerProvider.SNAPTRADE,
      mode: options.mode ?? BrokerLedgerIngestionMode.SYNC,
    },
  });
  const result: LedgerIngestionResult = {
    runId: run.id,
    sourceCount: 0,
    insertedCount: 0,
    linkedCount: 0,
    canonicalizedCount: 0,
    ignoredCount: 0,
    conflictCount: 0,
  };

  try {
    const activities = await prisma.snapTradeActivity.findMany({
      where: {
        tenantId,
        ...(options.accountIds?.length ? { accountId: { in: options.accountIds } } : {}),
      },
      orderBy: [{ tradeDate: "asc" }, { snapTradeActivityId: "asc" }],
      include: {
        account: {
          select: {
            snapTradeAccountId: true,
            rawType: true,
            unifiedAccountType: true,
            tracked: true,
          },
        },
      },
    });
    result.sourceCount = activities.length;
    const excludedAccountIds = [
      ...new Set(
        activities
          .filter(
            (activity) =>
              !eligibleAccount(activity.account.unifiedAccountType, activity.account.rawType)
          )
          .map((activity) => activity.accountId)
      ),
    ];
    if (excludedAccountIds.length > 0) {
      await prisma.brokerLedgerCoverage.deleteMany({
        where: { tenantId, accountId: { in: excludedAccountIds } },
      });
    }
    const pairedTransfers = transferPairs(activities);
    const entries = await prisma.brokerLedgerEntry.findMany({
      where: {
        tenantId,
        ...(options.accountIds?.length ? { accountId: { in: options.accountIds } } : {}),
      },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    });
    const usedBySnapTrade = new Set(
      (
        await prisma.brokerLedgerSourceRecord.findMany({
          where: {
            tenantId,
            provider: BrokerLedgerProvider.SNAPTRADE,
            ledgerEntryId: { not: null },
          },
          select: { ledgerEntryId: true },
        })
      )
        .map((record) => record.ledgerEntryId)
        .filter((id): id is string => id != null)
    );
    const touchedAccountIds = new Set<string>();

    for (const activity of activities) {
      const baseSource = {
        tenantId,
        accountId: activity.accountId,
        ingestionRunId: run.id,
        provider: BrokerLedgerProvider.SNAPTRADE,
        sourceKey: sourceKey(activity.snapTradeActivityId),
        providerRecordId: activity.snapTradeActivityId,
        raw: (activity.raw ?? null) as Prisma.InputJsonValue,
      };
      if (!eligibleAccount(activity.account.unifiedAccountType, activity.account.rawType)) {
        await prisma.brokerLedgerSourceRecord.upsert({
          where: {
            tenantId_provider_sourceKey: {
              tenantId,
              provider: BrokerLedgerProvider.SNAPTRADE,
              sourceKey: sourceKey(activity.snapTradeActivityId),
            },
          },
          create: { ...baseSource, status: BrokerLedgerSourceStatus.IGNORED },
          update: {
            ingestionRunId: run.id,
            status: BrokerLedgerSourceStatus.IGNORED,
            ledgerEntryId: null,
            conflictReason: "Account class is outside canonical brokerage scope",
            raw: baseSource.raw,
          },
        });
        result.ignoredCount += 1;
        continue;
      }
      touchedAccountIds.add(activity.accountId);

      let candidate: CanonicalCandidate | null;
      try {
        candidate = await normalizedCandidate(activity, pairedTransfers);
      } catch (error) {
        candidate = null;
        const message = error instanceof Error ? error.message : String(error);
        await prisma.brokerLedgerSourceRecord.upsert({
          where: {
            tenantId_provider_sourceKey: {
              tenantId,
              provider: BrokerLedgerProvider.SNAPTRADE,
              sourceKey: sourceKey(activity.snapTradeActivityId),
            },
          },
          create: {
            ...baseSource,
            status: BrokerLedgerSourceStatus.CONFLICT,
            conflictReason: message,
          },
          update: {
            ingestionRunId: run.id,
            status: BrokerLedgerSourceStatus.CONFLICT,
            ledgerEntryId: null,
            conflictReason: message,
            raw: baseSource.raw,
          },
        });
        result.conflictCount += 1;
        continue;
      }
      if (!candidate) {
        await prisma.brokerLedgerSourceRecord.upsert({
          where: {
            tenantId_provider_sourceKey: {
              tenantId,
              provider: BrokerLedgerProvider.SNAPTRADE,
              sourceKey: sourceKey(activity.snapTradeActivityId),
            },
          },
          create: {
            ...baseSource,
            status: BrokerLedgerSourceStatus.CONFLICT,
            conflictReason: `Unsupported SnapTrade activity type ${activity.type}`,
          },
          update: {
            ingestionRunId: run.id,
            status: BrokerLedgerSourceStatus.CONFLICT,
            ledgerEntryId: null,
            conflictReason: `Unsupported SnapTrade activity type ${activity.type}`,
            raw: baseSource.raw,
          },
        });
        result.conflictCount += 1;
        continue;
      }

      const existingSource = await prisma.brokerLedgerSourceRecord.findUnique({
        where: {
          tenantId_provider_sourceKey: {
            tenantId,
            provider: BrokerLedgerProvider.SNAPTRADE,
            sourceKey: sourceKey(activity.snapTradeActivityId),
          },
        },
        select: { ledgerEntryId: true },
      });
      let ledgerEntry = existingSource?.ledgerEntryId
        ? (entries.find((entry) => entry.id === existingSource.ledgerEntryId) ?? null)
        : null;
      let confidence: Prisma.Decimal | null = ledgerEntry ? new Prisma.Decimal(1) : null;
      let conflict: string | null = null;

      if (!ledgerEntry) {
        ledgerEntry =
          entries.find(
            (entry) =>
              entry.dedupeKey === phaseFiveDedupeKey(tenantId, activity.snapTradeActivityId)
          ) ?? null;
      }
      if (!ledgerEntry && candidate.activitySubType !== "TAX") {
        const match = bestLedgerMatch(
          entries.filter((entry) => entry.accountId === activity.accountId),
          candidate,
          usedBySnapTrade
        );
        ledgerEntry = match.entry;
        confidence = match.confidence;
        conflict = match.conflict;
      }
      if (conflict) {
        await prisma.brokerLedgerSourceRecord.upsert({
          where: {
            tenantId_provider_sourceKey: {
              tenantId,
              provider: BrokerLedgerProvider.SNAPTRADE,
              sourceKey: sourceKey(activity.snapTradeActivityId),
            },
          },
          create: {
            ...baseSource,
            ...candidate,
            status: BrokerLedgerSourceStatus.CONFLICT,
            conflictReason: conflict,
          },
          update: {
            ingestionRunId: run.id,
            ...candidate,
            status: BrokerLedgerSourceStatus.CONFLICT,
            ledgerEntryId: null,
            conflictReason: conflict,
            raw: baseSource.raw,
          },
        });
        result.conflictCount += 1;
        continue;
      }

      if (!ledgerEntry) {
        ledgerEntry = await prisma.brokerLedgerEntry.upsert({
          where: { dedupeKey: canonicalDedupeKey(tenantId, activity.snapTradeActivityId) },
          create: {
            tenantId,
            accountId: activity.accountId,
            accountExternalId: activity.account.snapTradeAccountId,
            accountType: activity.account.rawType ?? "Unknown",
            ...candidate,
            dedupeKey: canonicalDedupeKey(tenantId, activity.snapTradeActivityId),
            raw: (activity.raw ?? null) as Prisma.InputJsonValue,
          },
          update: {
            settlementDate: candidate.settlementDate,
            symbol: candidate.symbol,
            symbolNorm: candidate.symbolNorm,
            name: candidate.name,
            currency: candidate.currency,
            units: candidate.units,
            unitPrice: candidate.unitPrice,
            nativeCashAmount: candidate.nativeCashAmount,
            nativeCurrency: candidate.nativeCurrency,
            cashAmount: candidate.cashAmount,
            fxRate: candidate.fxRate,
            raw: (activity.raw ?? null) as Prisma.InputJsonValue,
          },
        });
        entries.push(ledgerEntry);
        result.insertedCount += 1;
        result.canonicalizedCount += 1;
        confidence = new Prisma.Decimal(1);
      } else {
        result.linkedCount += 1;
      }
      usedBySnapTrade.add(ledgerEntry.id);

      await prisma.brokerLedgerSourceRecord.upsert({
        where: {
          tenantId_provider_sourceKey: {
            tenantId,
            provider: BrokerLedgerProvider.SNAPTRADE,
            sourceKey: sourceKey(activity.snapTradeActivityId),
          },
        },
        create: {
          ...baseSource,
          ...candidate,
          ledgerEntryId: ledgerEntry.id,
          status: BrokerLedgerSourceStatus.LINKED,
          matchConfidence: confidence,
        },
        update: {
          ingestionRunId: run.id,
          ...candidate,
          ledgerEntryId: ledgerEntry.id,
          status: BrokerLedgerSourceStatus.LINKED,
          matchConfidence: confidence,
          conflictReason: null,
          raw: baseSource.raw,
        },
      });
    }

    await refreshBrokerLedgerCoverage(tenantId, [...touchedAccountIds]);
    await prisma.brokerLedgerIngestionRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.SUCCESS,
        completedAt: new Date(),
        sourceCount: result.sourceCount,
        insertedCount: result.insertedCount,
        linkedCount: result.linkedCount,
        canonicalizedCount: result.canonicalizedCount,
        ignoredCount: result.ignoredCount,
        conflictCount: result.conflictCount,
      },
    });
    return result;
  } catch (error) {
    await prisma.brokerLedgerIngestionRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.ERROR,
        completedAt: new Date(),
        sourceCount: result.sourceCount,
        insertedCount: result.insertedCount,
        linkedCount: result.linkedCount,
        canonicalizedCount: result.canonicalizedCount,
        ignoredCount: result.ignoredCount,
        conflictCount: result.conflictCount,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function backfillCsvSourceRecords(tenantId: string): Promise<LedgerIngestionResult> {
  const run = await prisma.brokerLedgerIngestionRun.create({
    data: {
      tenantId,
      provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
      mode: BrokerLedgerIngestionMode.MIGRATION,
    },
  });
  const allEntries = await prisma.brokerLedgerEntry.findMany({
    where: { tenantId },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
  });
  const entries = allEntries.filter((entry) => rawObject(entry.raw)?.transaction_date != null);
  let insertedCount = 0;
  for (const entry of entries) {
    const existing = await prisma.brokerLedgerSourceRecord.findUnique({
      where: {
        tenantId_provider_sourceKey: {
          tenantId,
          provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
          sourceKey: entry.dedupeKey,
        },
      },
      select: { id: true },
    });
    await prisma.brokerLedgerSourceRecord.upsert({
      where: {
        tenantId_provider_sourceKey: {
          tenantId,
          provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
          sourceKey: entry.dedupeKey,
        },
      },
      create: {
        tenantId,
        accountId: entry.accountId,
        ledgerEntryId: entry.id,
        ingestionRunId: run.id,
        provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
        sourceKey: entry.dedupeKey,
        status: BrokerLedgerSourceStatus.LINKED,
        matchConfidence: new Prisma.Decimal(1),
        tradeDate: entry.tradeDate,
        settlementDate: entry.settlementDate,
        activityType: entry.activityType,
        activitySubType: entry.activitySubType,
        symbol: entry.symbol,
        symbolNorm: entry.symbolNorm,
        name: entry.name,
        currency: entry.currency,
        units: entry.units,
        unitPrice: entry.unitPrice,
        nativeCashAmount: entry.nativeCashAmount ?? entry.cashAmount,
        nativeCurrency: entry.nativeCurrency ?? "CAD",
        cashAmount: entry.cashAmount,
        fxRate: entry.fxRate ?? (entry.cashAmount == null ? null : new Prisma.Decimal(1)),
        raw: (entry.raw ?? null) as Prisma.InputJsonValue,
      },
      update: {
        ledgerEntryId: entry.id,
        ingestionRunId: run.id,
        status: BrokerLedgerSourceStatus.LINKED,
        conflictReason: null,
      },
    });
    if (!existing) insertedCount += 1;
  }
  await refreshBrokerLedgerCoverage(tenantId, [
    ...new Set(entries.map((entry) => entry.accountId).filter((id): id is string => id != null)),
  ]);
  await prisma.brokerLedgerIngestionRun.update({
    where: { id: run.id },
    data: {
      status: SyncRunStatus.SUCCESS,
      completedAt: new Date(),
      sourceCount: entries.length,
      insertedCount,
      linkedCount: entries.length,
    },
  });
  return {
    runId: run.id,
    sourceCount: entries.length,
    insertedCount,
    linkedCount: entries.length,
    canonicalizedCount: 0,
    ignoredCount: 0,
    conflictCount: 0,
  };
}
