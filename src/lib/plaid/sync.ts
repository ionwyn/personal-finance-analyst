import { PlaidItemStatus, Prisma, SyncRunStatus, SyncSource, TenantKind } from "@prisma/client";
import type { RemovedTransaction, Transaction } from "plaid";

import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/security/token-crypto";
import { getPlaidClient } from "@/lib/plaid/client";
import { fetchAndCacheInstitutionLogo } from "@/lib/plaid/institution";
import {
  errorMessage,
  getPlaidErrorCode,
  getPlaidRequestId,
  isTransactionsMutationDuringPagination,
} from "@/lib/plaid/errors";
import { normalizeTransaction, summarizeTransactionChanges } from "@/lib/plaid/normalize";
import { refreshAccountsForItem, refreshBalancesForItem } from "@/lib/plaid/accounts";
import { fetchAndStoreRecurring, shouldFetchRecurring } from "@/lib/plaid/recurring";
import { getPlaidEnv, isPlaidRecurringEnabled } from "@/lib/env";
import { classifyTransaction, type ClassifyContext } from "@/lib/cycles/classify";
import { loadClassifyContext } from "@/lib/cycles/context";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import { recomputeCycleTotals } from "@/lib/cycles/recomputeTotals";
import { reconcileSweeps } from "@/lib/cycles/sweepReconcile";
import {
  elapsedMs,
  ensureRequestId,
  logger,
  normalizeSyncSource,
  safeError,
  withLogContext,
} from "@/lib/logger";
import { ACTIVE_LOCK_MS, recoverStuckSyncEntities } from "@/lib/sync/lifecycle";

const PAGE_SIZE = 500;

type CycleSyncState = {
  context: ClassifyContext;
  affectedCycleIds: Set<string>;
  errors: string[];
};

type PlaidItemWithTenant = Prisma.PlaidItemGetPayload<{ include: { tenant: true } }>;

async function applyAddedOrModified(input: {
  tenantId: string;
  itemId: string;
  transaction: Transaction;
  cycleState?: CycleSyncState;
}) {
  const normalized = normalizeTransaction(input.transaction);
  const account = await prisma.plaidAccount.findUnique({
    where: { plaidAccountId: normalized.plaidAccountId },
    select: { id: true, tracked: true },
  });

  if (!account) {
    throw new Error(
      `Missing Plaid account ${normalized.plaidAccountId} for transaction ${normalized.plaidTransactionId}`
    );
  }

  // Untracked accounts are excluded everywhere — do not store their transactions.
  if (!account.tracked) return;

  const existing = await prisma.plaidTransaction.findUnique({
    where: { plaidTransactionId: normalized.plaidTransactionId },
    select: { id: true, txnType: true },
  });

  const cycleFields: { cycleId?: string; txnType?: string } = {};

  if (input.cycleState) {
    try {
      const cycle = await ensureCycleForDate(input.tenantId, normalized.date);
      cycleFields.cycleId = cycle.id;
      input.cycleState.affectedCycleIds.add(cycle.id);

      const classified = classifyTransaction(
        {
          amount: normalized.amount,
          merchantName: normalized.merchantName,
          name: normalized.name,
          categoryPrimary: normalized.categoryPrimary,
          categoryDetailed: normalized.categoryDetailed,
          date: normalized.date,
          existingTxnType: existing?.txnType ?? null,
        },
        input.cycleState.context
      );
      cycleFields.txnType = classified.txnType;
    } catch (error) {
      input.cycleState.errors.push(
        `classify ${normalized.plaidTransactionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  await prisma.plaidTransaction.upsert({
    where: {
      plaidTransactionId: normalized.plaidTransactionId,
    },
    update: {
      accountId: account.id,
      pendingTransactionId: normalized.pendingTransactionId,
      name: normalized.name,
      merchantName: normalized.merchantName,
      amount: normalized.amount,
      isoCurrencyCode: normalized.isoCurrencyCode,
      unofficialCurrencyCode: normalized.unofficialCurrencyCode,
      date: normalized.date,
      authorizedDate: normalized.authorizedDate,
      datetime: normalized.datetime,
      authorizedDatetime: normalized.authorizedDatetime,
      paymentChannel: normalized.paymentChannel,
      categoryPrimary: normalized.categoryPrimary,
      categoryDetailed: normalized.categoryDetailed,
      categoryConfidence: normalized.categoryConfidence,
      pending: normalized.pending,
      removed: false,
      raw: normalized.raw,
      ...cycleFields,
    },
    create: {
      tenantId: input.tenantId,
      itemId: input.itemId,
      accountId: account.id,
      plaidTransactionId: normalized.plaidTransactionId,
      pendingTransactionId: normalized.pendingTransactionId,
      name: normalized.name,
      merchantName: normalized.merchantName,
      amount: normalized.amount,
      isoCurrencyCode: normalized.isoCurrencyCode,
      unofficialCurrencyCode: normalized.unofficialCurrencyCode,
      date: normalized.date,
      authorizedDate: normalized.authorizedDate,
      datetime: normalized.datetime,
      authorizedDatetime: normalized.authorizedDatetime,
      paymentChannel: normalized.paymentChannel,
      categoryPrimary: normalized.categoryPrimary,
      categoryDetailed: normalized.categoryDetailed,
      categoryConfidence: normalized.categoryConfidence,
      pending: normalized.pending,
      raw: normalized.raw,
      ...cycleFields,
    },
  });
}

async function applyRemoved(transaction: RemovedTransaction, cycleState?: CycleSyncState) {
  if (cycleState) {
    const existing = await prisma.plaidTransaction.findUnique({
      where: { plaidTransactionId: transaction.transaction_id },
      select: { cycleId: true },
    });
    if (existing?.cycleId) cycleState.affectedCycleIds.add(existing.cycleId);
  }

  await prisma.plaidTransaction.updateMany({
    where: {
      plaidTransactionId: transaction.transaction_id,
    },
    data: {
      removed: true,
    },
  });
}

async function applyTransactionChanges(input: {
  tenantId: string;
  itemId: string;
  added: Transaction[];
  modified: Transaction[];
  removed: RemovedTransaction[];
  cycleState?: CycleSyncState;
}) {
  for (const transaction of input.added) {
    await applyAddedOrModified({
      tenantId: input.tenantId,
      itemId: input.itemId,
      transaction,
      cycleState: input.cycleState,
    });
  }

  for (const transaction of input.modified) {
    await applyAddedOrModified({
      tenantId: input.tenantId,
      itemId: input.itemId,
      transaction,
      cycleState: input.cycleState,
    });
  }

  for (const transaction of input.removed) {
    await applyRemoved(transaction, input.cycleState);
  }

  return summarizeTransactionChanges(input);
}

export async function syncPlaidItem(itemId: string, source: SyncSource) {
  const item = await prisma.plaidItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { tenant: true },
  });

  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "plaid",
      tenantId: item.tenantId,
      syncSource: normalizeSyncSource(source),
    },
    async () => syncPlaidItemWithContext(item, source)
  );
}

async function syncPlaidItemWithContext(item: PlaidItemWithTenant, source: SyncSource) {
  const startedAt = performance.now();
  logger.info({ itemId: item.id }, "plaid sync started");

  const lockResult = await prisma.plaidItem.updateMany({
    where: {
      id: item.id,
      OR: [
        { status: { in: [PlaidItemStatus.IDLE, PlaidItemStatus.ERROR] } },
        {
          status: PlaidItemStatus.SYNCING,
          updatedAt: { lt: new Date(Date.now() - ACTIVE_LOCK_MS) },
        },
      ],
    },
    data: {
      status: PlaidItemStatus.SYNCING,
      errorCode: null,
      errorMessage: null,
    },
  });

  if (lockResult.count === 0) {
    const skippedRun = await prisma.syncRun.create({
      data: {
        tenantId: item.tenantId,
        itemId: item.id,
        source,
        status: SyncRunStatus.SKIPPED,
        completedAt: new Date(),
        errorMessage: "Skipped: another sync is in progress.",
      },
    });
    logger.info(
      {
        duration: elapsedMs(startedAt),
        itemId: item.id,
        status: skippedRun.status,
      },
      "plaid sync skipped"
    );
    return skippedRun;
  }

  await fetchAndCacheInstitutionLogo(item.id, item.institutionId);

  const run = await prisma.syncRun.create({
    data: {
      tenantId: item.tenantId,
      itemId: item.id,
      source,
      status: SyncRunStatus.RUNNING,
    },
  });

  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;
  let accountsCount = 0;
  let requestId: string | undefined;
  let cycleState: CycleSyncState | undefined;

  try {
    try {
      const context = await loadClassifyContext(item.tenantId);
      cycleState = { context, affectedCycleIds: new Set(), errors: [] };
    } catch (error) {
      // Classification is non-fatal — log the failure but proceed with the raw sync.
      logger.warn({ error: safeError(error) }, "failed to load cycle classification context");
    }

    const accessToken = decryptToken(item.accessTokenEncrypted);
    accountsCount = await refreshAccountsForItem(item.id);

    const client = getPlaidClient();
    const originalCursor = item.syncCursor ?? undefined;
    let cursor = originalCursor;
    let nextCursor = originalCursor;
    let hasMore = true;
    let mutationRestarts = 0;

    while (hasMore) {
      try {
        const response = await client.transactionsSync({
          access_token: accessToken,
          cursor,
          count: PAGE_SIZE,
        });

        const changes = await applyTransactionChanges({
          tenantId: item.tenantId,
          itemId: item.id,
          added: response.data.added,
          modified: response.data.modified,
          removed: response.data.removed,
          cycleState,
        });

        addedCount += changes.addedCount;
        modifiedCount += changes.modifiedCount;
        removedCount += changes.removedCount;
        nextCursor = response.data.next_cursor;
        cursor = response.data.next_cursor;
        hasMore = response.data.has_more;
        requestId = response.data.request_id;
      } catch (error) {
        if (isTransactionsMutationDuringPagination(error) && mutationRestarts < 2) {
          mutationRestarts += 1;
          cursor = originalCursor;
          nextCursor = originalCursor;
          hasMore = true;
          addedCount = 0;
          modifiedCount = 0;
          removedCount = 0;
          if (cycleState) {
            cycleState.affectedCycleIds.clear();
            cycleState.errors.length = 0;
          }
          continue;
        }
        throw error;
      }
    }

    if (cycleState && cycleState.affectedCycleIds.size > 0) {
      for (const cycleId of cycleState.affectedCycleIds) {
        try {
          await recomputeCycleTotals(item.tenantId, cycleId);
        } catch (error) {
          cycleState.errors.push(
            `recomputeCycleTotals ${cycleId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      try {
        await reconcileSweeps(item.tenantId, Array.from(cycleState.affectedCycleIds));
      } catch (error) {
        cycleState.errors.push(
          `reconcileSweeps: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    await prisma.plaidItem.update({
      where: { id: item.id },
      data: {
        syncCursor: nextCursor,
        lastSyncAt: new Date(),
        status: PlaidItemStatus.IDLE,
      },
    });

    const cycleErrorMessage = cycleState?.errors.length
      ? cycleState.errors.slice(0, 5).join("; ")
      : null;

    const updatedRun = await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.SUCCESS,
        completedAt: new Date(),
        addedCount,
        modifiedCount,
        removedCount,
        accountsCount,
        plaidRequestId: requestId,
        errorMessage: cycleErrorMessage,
      },
    });
    logger.info(
      {
        duration: elapsedMs(startedAt),
        itemId: item.id,
        status: updatedRun.status,
        addedCount,
        modifiedCount,
        removedCount,
        accountsCount,
        providerRequestId: requestId,
        cycleErrorsCount: cycleState?.errors.length ?? 0,
      },
      "plaid sync completed"
    );
    return updatedRun;
  } catch (error) {
    const code = getPlaidErrorCode(error);
    await prisma.plaidItem.update({
      where: { id: item.id },
      data: {
        status: PlaidItemStatus.ERROR,
        errorCode: code,
        errorMessage: errorMessage(error),
      },
    });

    const updatedRun = await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.ERROR,
        completedAt: new Date(),
        addedCount,
        modifiedCount,
        removedCount,
        accountsCount,
        errorCode: code,
        errorMessage: errorMessage(error),
        plaidRequestId: getPlaidRequestId(error),
      },
    });
    logger.error(
      {
        duration: elapsedMs(startedAt),
        itemId: item.id,
        status: updatedRun.status,
        errorCode: code,
        error: safeError(error),
        providerRequestId: getPlaidRequestId(error),
      },
      "plaid sync failed"
    );
    return updatedRun;
  }
}

function shouldRefreshBalance(input: {
  tenantKind: TenantKind;
  lastBalanceRefreshAt?: Date | null;
}) {
  if (getPlaidEnv() === "sandbox" || input.tenantKind === TenantKind.DEMO) return true;
  if (!input.lastBalanceRefreshAt) return true;
  return Date.now() - input.lastBalanceRefreshAt.getTime() > 23 * 60 * 60 * 1000;
}

async function recoverStuckSyncRuns() {
  await recoverStuckSyncEntities({
    runDelegate: prisma.syncRun,
    entityDelegate: prisma.plaidItem,
    entityStuckStatus: PlaidItemStatus.SYNCING,
    entityResetStatus: PlaidItemStatus.ERROR,
    entityResetMessage: "PlaidItem was stuck in SYNCING state and was reset by the watchdog.",
  });
}

async function syncAllPlaidItemsForTenant(tenantId: string, source: SyncSource) {
  const items = await prisma.plaidItem.findMany({
    where: { tenantId },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const item of items) {
    const syncRun = await syncPlaidItem(item.id, source);
    if (
      shouldRefreshBalance({
        tenantKind: item.tenant.kind,
        lastBalanceRefreshAt: item.lastBalanceRefreshAt,
      })
    ) {
      await refreshBalancesForItem(item.id);
    }
    // Recurring streams: cost-gated to ~once/day per item (and behind a kill-switch).
    // Non-fatal — fetchAndStoreRecurring never throws.
    if (
      isPlaidRecurringEnabled() &&
      shouldFetchRecurring({
        tenantKind: item.tenant.kind,
        lastRecurringFetchAt: item.lastRecurringFetchAt,
      })
    ) {
      await fetchAndStoreRecurring(item.id);
    }
    results.push(syncRun);
  }
  return results;
}

export async function syncAllPlaidItems(source: SyncSource = SyncSource.SCHEDULED) {
  await recoverStuckSyncRuns();

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const results = [];
  for (const tenant of tenants) {
    results.push(...(await syncAllPlaidItemsForTenant(tenant.id, source)));
  }
  return results;
}
