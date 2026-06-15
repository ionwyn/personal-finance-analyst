import {
  BrokerLedgerIngestionMode,
  BrokerLedgerProvider,
  BrokerLedgerSourceStatus,
  Prisma,
  SyncRunStatus,
  type BrokerLedgerEntry,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  bestLedgerMatch,
  refreshBrokerLedgerCoverage,
  type CanonicalCandidate,
} from "./ledger-sync";

export type CanonicalCsvEntry = {
  tenantId: string;
  accountId: string;
  accountExternalId: string;
  accountType: string;
  tradeDate: Date;
  settlementDate: Date | null;
  activityType: string;
  activitySubType: string | null;
  symbol: string | null;
  symbolNorm: string | null;
  name: string | null;
  currency: string | null;
  units: Prisma.Decimal;
  unitPrice: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  dedupeKey: string;
  raw: Prisma.InputJsonValue;
};

export type CsvImportPreview = {
  sourceCount: number;
  existingCount: number;
  linkedCount: number;
  newCount: number;
  conflictCount: number;
  accountCoverage: Array<{
    accountId: string;
    startDate: string;
    endDate: string;
    rowCount: number;
  }>;
  unresolved: Array<{ sourceKey: string; reason: string }>;
};

type MatchingContext = {
  ledger: BrokerLedgerEntry[];
  sourceByKey: Map<string, { sourceKey: string; ledgerEntryId: string | null }>;
  usedEntryIds: Set<string>;
};

function candidate(entry: CanonicalCsvEntry): CanonicalCandidate {
  return {
    activityType: entry.activityType,
    activitySubType: entry.activitySubType,
    tradeDate: entry.tradeDate,
    settlementDate: entry.settlementDate,
    symbol: entry.symbol,
    symbolNorm: entry.symbolNorm,
    name: entry.name,
    currency: entry.currency,
    units: entry.units,
    unitPrice: entry.unitPrice,
    nativeCashAmount: entry.cashAmount,
    nativeCurrency: "CAD",
    cashAmount: entry.cashAmount,
    fxRate: entry.cashAmount == null ? null : new Prisma.Decimal(1),
  };
}

function coverage(entries: CanonicalCsvEntry[]): CsvImportPreview["accountCoverage"] {
  const byAccount = new Map<string, CanonicalCsvEntry[]>();
  for (const entry of entries) {
    const rows = byAccount.get(entry.accountId) ?? [];
    rows.push(entry);
    byAccount.set(entry.accountId, rows);
  }
  return [...byAccount].map(([accountId, rows]) => {
    const dates = rows.map((row) => row.tradeDate.toISOString().slice(0, 10)).sort();
    return {
      accountId,
      startDate: dates[0]!,
      endDate: dates.at(-1)!,
      rowCount: rows.length,
    };
  });
}

async function matchingContext(entries: CanonicalCsvEntry[]): Promise<MatchingContext> {
  const tenantId = entries[0]?.tenantId;
  if (!tenantId) return { ledger: [], sourceByKey: new Map(), usedEntryIds: new Set<string>() };
  if (entries.some((entry) => entry.tenantId !== tenantId)) {
    throw new Error("A CSV ingestion batch cannot span tenants");
  }
  const [ledger, sources] = await Promise.all([
    prisma.brokerLedgerEntry.findMany({
      where: { tenantId },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    }),
    prisma.brokerLedgerSourceRecord.findMany({
      where: { tenantId, provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV },
      select: { sourceKey: true, ledgerEntryId: true },
    }),
  ]);
  return {
    ledger,
    sourceByKey: new Map(sources.map((source) => [source.sourceKey, source])),
    usedEntryIds: new Set(
      sources.map((source) => source.ledgerEntryId).filter((id): id is string => id != null)
    ),
  };
}

function resolveEntry(
  entry: CanonicalCsvEntry,
  ledger: BrokerLedgerEntry[],
  sourceByKey: Map<string, { sourceKey: string; ledgerEntryId: string | null }>,
  usedEntryIds: Set<string>
) {
  const source = sourceByKey.get(entry.dedupeKey);
  if (source?.ledgerEntryId) {
    return {
      ledgerEntry: ledger.find((row) => row.id === source.ledgerEntryId) ?? null,
      conflict: null,
    };
  }
  const direct = ledger.find((row) => row.dedupeKey === entry.dedupeKey);
  if (direct) return { ledgerEntry: direct, conflict: null };
  const match = bestLedgerMatch(
    ledger.filter((row) => row.accountId === entry.accountId),
    candidate(entry),
    usedEntryIds
  );
  return { ledgerEntry: match.entry, conflict: match.conflict };
}

export async function previewCanonicalCsvEntries(
  entries: CanonicalCsvEntry[]
): Promise<CsvImportPreview> {
  const { ledger, sourceByKey, usedEntryIds } = await matchingContext(entries);
  const preview: CsvImportPreview = {
    sourceCount: entries.length,
    existingCount: 0,
    linkedCount: 0,
    newCount: 0,
    conflictCount: 0,
    accountCoverage: coverage(entries),
    unresolved: [],
  };
  for (const entry of entries) {
    if (sourceByKey.has(entry.dedupeKey)) preview.existingCount += 1;
    const resolved = resolveEntry(entry, ledger, sourceByKey, usedEntryIds);
    if (resolved.conflict) {
      preview.conflictCount += 1;
      preview.unresolved.push({ sourceKey: entry.dedupeKey, reason: resolved.conflict });
    } else if (resolved.ledgerEntry) {
      preview.linkedCount += 1;
      usedEntryIds.add(resolved.ledgerEntry.id);
    } else {
      preview.newCount += 1;
    }
  }
  return preview;
}

export async function commitCanonicalCsvEntries(entries: CanonicalCsvEntry[]) {
  const tenantId = entries[0]?.tenantId;
  if (!tenantId) {
    return { inserted: 0, updated: 0, linked: 0, conflicts: 0, runId: null };
  }
  const run = await prisma.brokerLedgerIngestionRun.create({
    data: {
      tenantId,
      provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
      mode: BrokerLedgerIngestionMode.IMPORT,
    },
  });
  const { ledger, sourceByKey, usedEntryIds } = await matchingContext(entries);
  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let conflicts = 0;

  try {
    for (const entry of entries) {
      const normalized = candidate(entry);
      const resolved = resolveEntry(entry, ledger, sourceByKey, usedEntryIds);
      if (resolved.conflict) {
        conflicts += 1;
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
            ingestionRunId: run.id,
            provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
            sourceKey: entry.dedupeKey,
            status: BrokerLedgerSourceStatus.CONFLICT,
            conflictReason: resolved.conflict,
            ...normalized,
            raw: entry.raw,
          },
          update: {
            ingestionRunId: run.id,
            ledgerEntryId: null,
            status: BrokerLedgerSourceStatus.CONFLICT,
            conflictReason: resolved.conflict,
            ...normalized,
            raw: entry.raw,
          },
        });
        continue;
      }

      let ledgerEntry = resolved.ledgerEntry;
      if (ledgerEntry) {
        ledgerEntry = await prisma.brokerLedgerEntry.update({
          where: { id: ledgerEntry.id },
          data: {
            accountId: entry.accountId,
            accountExternalId: entry.accountExternalId,
            accountType: entry.accountType,
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
            nativeCashAmount: entry.cashAmount,
            nativeCurrency: "CAD",
            cashAmount: entry.cashAmount,
            fxRate: entry.cashAmount == null ? null : new Prisma.Decimal(1),
            raw: entry.raw,
          },
        });
        if (sourceByKey.has(entry.dedupeKey)) updated += 1;
        else linked += 1;
      } else {
        ledgerEntry = await prisma.brokerLedgerEntry.create({
          data: {
            ...entry,
            nativeCashAmount: entry.cashAmount,
            nativeCurrency: "CAD",
            fxRate: entry.cashAmount == null ? null : new Prisma.Decimal(1),
          },
        });
        ledger.push(ledgerEntry);
        inserted += 1;
      }
      usedEntryIds.add(ledgerEntry.id);

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
          ledgerEntryId: ledgerEntry.id,
          ingestionRunId: run.id,
          provider: BrokerLedgerProvider.WEALTHSIMPLE_CSV,
          sourceKey: entry.dedupeKey,
          status: BrokerLedgerSourceStatus.LINKED,
          matchConfidence: new Prisma.Decimal(1),
          ...normalized,
          raw: entry.raw,
        },
        update: {
          accountId: entry.accountId,
          ledgerEntryId: ledgerEntry.id,
          ingestionRunId: run.id,
          status: BrokerLedgerSourceStatus.LINKED,
          matchConfidence: new Prisma.Decimal(1),
          conflictReason: null,
          ...normalized,
          raw: entry.raw,
        },
      });
    }
    await refreshBrokerLedgerCoverage(tenantId, [
      ...new Set(entries.map((entry) => entry.accountId)),
    ]);
    await prisma.brokerLedgerIngestionRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.SUCCESS,
        completedAt: new Date(),
        sourceCount: entries.length,
        insertedCount: inserted,
        linkedCount: linked,
        canonicalizedCount: inserted,
        conflictCount: conflicts,
      },
    });
    return { inserted, updated, linked, conflicts, runId: run.id };
  } catch (error) {
    await prisma.brokerLedgerIngestionRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.ERROR,
        completedAt: new Date(),
        sourceCount: entries.length,
        insertedCount: inserted,
        linkedCount: linked,
        canonicalizedCount: inserted,
        conflictCount: conflicts,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
