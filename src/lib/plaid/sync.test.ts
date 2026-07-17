import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaidItemStatus, SyncRunStatus, SyncSource, TenantKind } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  plaidItemFindUniqueOrThrow: vi.fn(),
  plaidItemFindMany: vi.fn(),
  plaidItemUpdateMany: vi.fn(),
  plaidItemUpdate: vi.fn(),
  syncRunCreate: vi.fn(),
  syncRunUpdate: vi.fn(),
  plaidAccountFindUnique: vi.fn(),
  plaidTransactionFindUnique: vi.fn(),
  plaidTransactionUpsert: vi.fn(),
  plaidTransactionUpdateMany: vi.fn(),
  tenantFindMany: vi.fn(),
  transactionsSync: vi.fn(),
  decryptToken: vi.fn(),
  refreshAccountsForItem: vi.fn(),
  refreshBalancesForItem: vi.fn(),
  loadClassifyContext: vi.fn(),
  classifyTransaction: vi.fn(),
  ensureCycleForDate: vi.fn(),
  recomputeCycleTotals: vi.fn(),
  reconcileSweeps: vi.fn(),
  recoverStuckSyncEntities: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plaidItem: {
      findUniqueOrThrow: mocks.plaidItemFindUniqueOrThrow,
      findMany: mocks.plaidItemFindMany,
      updateMany: mocks.plaidItemUpdateMany,
      update: mocks.plaidItemUpdate,
    },
    syncRun: {
      create: mocks.syncRunCreate,
      update: mocks.syncRunUpdate,
    },
    plaidAccount: { findUnique: mocks.plaidAccountFindUnique },
    plaidTransaction: {
      findUnique: mocks.plaidTransactionFindUnique,
      upsert: mocks.plaidTransactionUpsert,
      updateMany: mocks.plaidTransactionUpdateMany,
    },
    tenant: { findMany: mocks.tenantFindMany },
  },
}));

vi.mock("@/lib/security/token-crypto", () => ({
  decryptToken: mocks.decryptToken,
}));

vi.mock("@/lib/plaid/client", () => ({
  getPlaidClient: () => ({ transactionsSync: mocks.transactionsSync }),
}));

vi.mock("@/lib/plaid/accounts", () => ({
  refreshAccountsForItem: mocks.refreshAccountsForItem,
  refreshBalancesForItem: mocks.refreshBalancesForItem,
}));

vi.mock("@/lib/cycles/classify", () => ({
  classifyTransaction: mocks.classifyTransaction,
}));

vi.mock("@/lib/cycles/context", () => ({
  loadClassifyContext: mocks.loadClassifyContext,
}));

vi.mock("@/lib/cycles/generate", () => ({
  ensureCycleForDate: mocks.ensureCycleForDate,
}));

vi.mock("@/lib/cycles/recomputeTotals", () => ({
  recomputeCycleTotals: mocks.recomputeCycleTotals,
}));

vi.mock("@/lib/cycles/sweepReconcile", () => ({
  reconcileSweeps: mocks.reconcileSweeps,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withLogContext: (_ctx: unknown, fn: () => unknown) => fn(),
  ensureRequestId: () => "req-test",
  normalizeSyncSource: (s: string) => s,
  elapsedMs: () => 1,
  safeError: (e: unknown) => e,
}));

vi.mock("@/lib/sync/lifecycle", () => ({
  ACTIVE_LOCK_MS: 900_000,
  recoverStuckSyncEntities: mocks.recoverStuckSyncEntities,
}));

vi.mock("@/lib/env", () => ({
  getPlaidEnv: () => "sandbox",
}));

import { syncAllPlaidItems, syncPlaidItem } from "@/lib/plaid/sync";

const TENANT_ID = "tenant_1";
const ITEM_ID = "item_1";

function fakeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    tenantId: TENANT_ID,
    accessTokenEncrypted: "enc:access-sandbox-token",
    syncCursor: null as string | null,
    status: PlaidItemStatus.IDLE,
    errorCode: null,
    errorMessage: null,
    lastSyncAt: null,
    lastBalanceRefreshAt: null,
    updatedAt: new Date(),
    tenant: { id: TENANT_ID, slug: "personal", kind: TenantKind.PERSONAL },
    ...overrides,
  };
}

function fakeSyncRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run_1",
    tenantId: TENANT_ID,
    itemId: ITEM_ID,
    source: SyncSource.MANUAL,
    status: SyncRunStatus.RUNNING,
    addedCount: 0,
    modifiedCount: 0,
    removedCount: 0,
    accountsCount: 2,
    ...overrides,
  };
}

function emptyPage(nextCursor = "cursor_next") {
  return {
    data: {
      added: [],
      modified: [],
      removed: [],
      next_cursor: nextCursor,
      has_more: false,
      request_id: "plaid_req_1",
    },
  };
}

// Minimal shape that satisfies normalizeTransaction without mocking it
function fakePlaidTransaction(id = "txn_1") {
  return {
    transaction_id: id,
    account_id: "acct_plaid_1",
    amount: 42.5,
    date: "2026-06-01",
    name: "Coffee Shop",
    pending: false,
    merchant_name: "Starbucks",
    personal_finance_category: {
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_COFFEE",
      confidence_level: "HIGH",
    },
    payment_channel: "online",
    iso_currency_code: "CAD",
    unofficial_currency_code: null,
    pending_transaction_id: null,
    authorized_date: null,
    datetime: null,
    authorized_datetime: null,
  };
}

function mutationError() {
  return Object.assign(new Error("Mutation during pagination"), {
    response: {
      data: {
        error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
        request_id: "req_mut",
      },
    },
  });
}

describe("syncPlaidItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.plaidItemFindUniqueOrThrow.mockResolvedValue(fakeItem());
    mocks.plaidItemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.plaidItemUpdate.mockResolvedValue(fakeItem());
    mocks.syncRunCreate.mockResolvedValue(fakeSyncRun());
    mocks.syncRunUpdate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.SUCCESS }));
    mocks.transactionsSync.mockResolvedValue(emptyPage());
    mocks.decryptToken.mockReturnValue("access-sandbox-token");
    mocks.refreshAccountsForItem.mockResolvedValue(2);
    mocks.loadClassifyContext.mockResolvedValue({ cycles: [], rules: [] });
    mocks.classifyTransaction.mockReturnValue({ txnType: "EXPENSE" });
    mocks.ensureCycleForDate.mockResolvedValue({ id: "cycle_1" });
    mocks.recomputeCycleTotals.mockResolvedValue(undefined);
    mocks.reconcileSweeps.mockResolvedValue(undefined);
    mocks.plaidAccountFindUnique.mockResolvedValue({ id: "db_acct_1", tracked: true });
    mocks.plaidTransactionFindUnique.mockResolvedValue(null);
    mocks.plaidTransactionUpsert.mockResolvedValue(undefined);
    mocks.plaidTransactionUpdateMany.mockResolvedValue({ count: 1 });
  });

  describe("sync lock", () => {
    it("returns a SKIPPED run when the lock is already held", async () => {
      mocks.plaidItemUpdateMany.mockResolvedValue({ count: 0 });
      mocks.syncRunCreate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.SKIPPED }));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.SKIPPED);
      expect(mocks.syncRunCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SyncRunStatus.SKIPPED }),
        })
      );
      expect(mocks.transactionsSync).not.toHaveBeenCalled();
    });

    it("transitions IDLE → SYNCING when acquiring the lock", async () => {
      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.plaidItemUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: ITEM_ID }),
          data: expect.objectContaining({ status: PlaidItemStatus.SYNCING }),
        })
      );
    });

    it("accepts an ERROR-status item (allows re-sync after error)", async () => {
      mocks.plaidItemFindUniqueOrThrow.mockResolvedValue(
        fakeItem({ status: PlaidItemStatus.ERROR })
      );

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.SUCCESS);
    });
  });

  describe("happy path", () => {
    it("returns a SUCCESS run and updates cursor after an empty page", async () => {
      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.SUCCESS);
      expect(mocks.plaidItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            syncCursor: "cursor_next",
            status: PlaidItemStatus.IDLE,
          }),
        })
      );
    });

    it("paginates until has_more is false, updating cursor to the last page", async () => {
      mocks.transactionsSync
        .mockResolvedValueOnce({
          data: {
            added: [],
            modified: [],
            removed: [],
            next_cursor: "cursor_p2",
            has_more: true,
            request_id: "req_p1",
          },
        })
        .mockResolvedValueOnce(emptyPage("cursor_p3"));

      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.transactionsSync).toHaveBeenCalledTimes(2);
      expect(mocks.plaidItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ syncCursor: "cursor_p3" }),
        })
      );
    });

    it("upserts added transactions for tracked accounts", async () => {
      mocks.transactionsSync.mockResolvedValue({
        data: {
          added: [fakePlaidTransaction("txn_a")],
          modified: [],
          removed: [],
          next_cursor: "cursor_2",
          has_more: false,
          request_id: "req_2",
        },
      });

      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.plaidTransactionUpsert).toHaveBeenCalledTimes(1);
      expect(mocks.plaidTransactionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { plaidTransactionId: "txn_a" },
        })
      );
    });

    it("skips upsert for untracked accounts", async () => {
      mocks.plaidAccountFindUnique.mockResolvedValue({ id: "db_acct_1", tracked: false });
      mocks.transactionsSync.mockResolvedValue({
        data: {
          added: [fakePlaidTransaction("txn_untracked")],
          modified: [],
          removed: [],
          next_cursor: "cursor_2",
          has_more: false,
          request_id: "req_3",
        },
      });

      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.plaidTransactionUpsert).not.toHaveBeenCalled();
    });

    it("soft-deletes removed transactions", async () => {
      mocks.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [{ transaction_id: "txn_gone" }],
          next_cursor: "cursor_3",
          has_more: false,
          request_id: "req_4",
        },
      });

      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.plaidTransactionUpdateMany).toHaveBeenCalledWith({
        where: { plaidTransactionId: "txn_gone" },
        data: { removed: true },
      });
    });

    it("recomputes cycle totals for the cycle a removed transaction belonged to", async () => {
      mocks.plaidTransactionFindUnique.mockResolvedValue({ cycleId: "cycle_removed" });
      mocks.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [{ transaction_id: "txn_gone" }],
          next_cursor: "cursor_3",
          has_more: false,
          request_id: "req_4",
        },
      });

      await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.recomputeCycleTotals).toHaveBeenCalledWith(TENANT_ID, "cycle_removed");
    });
  });

  describe("error handling", () => {
    it("sets item to ERROR and sync run to ERROR on Plaid API failure", async () => {
      const plaidError = Object.assign(new Error("Bad token"), {
        response: {
          data: { error_code: "INVALID_ACCESS_TOKEN", request_id: "req_err" },
        },
      });
      mocks.transactionsSync.mockRejectedValue(plaidError);
      mocks.syncRunUpdate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.ERROR }));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.ERROR);
      expect(mocks.plaidItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PlaidItemStatus.ERROR,
            errorCode: "INVALID_ACCESS_TOKEN",
          }),
        })
      );
      expect(mocks.syncRunUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SyncRunStatus.ERROR }),
        })
      );
    });
  });

  describe("mutation during pagination restart", () => {
    it("retries from the original cursor on the first mutation error", async () => {
      mocks.transactionsSync
        .mockRejectedValueOnce(mutationError())
        .mockResolvedValueOnce(emptyPage("cursor_after_restart"));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.transactionsSync).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(SyncRunStatus.SUCCESS);
    });

    it("succeeds after two restarts (at the retry limit)", async () => {
      mocks.transactionsSync
        .mockRejectedValueOnce(mutationError())
        .mockRejectedValueOnce(mutationError())
        .mockResolvedValueOnce(emptyPage());

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.transactionsSync).toHaveBeenCalledTimes(3);
      expect(result.status).toBe(SyncRunStatus.SUCCESS);
    });

    it("propagates to ERROR after exhausting the two-restart limit", async () => {
      // All calls throw a mutation error; the third propagates out of the loop
      mocks.transactionsSync.mockRejectedValue(mutationError());
      mocks.syncRunUpdate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.ERROR }));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(mocks.transactionsSync).toHaveBeenCalledTimes(3);
      expect(result.status).toBe(SyncRunStatus.ERROR);
      expect(mocks.plaidItemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PlaidItemStatus.ERROR }),
        })
      );
    });
  });

  describe("cycle classification", () => {
    it("continues sync as SUCCESS when cycle context load fails", async () => {
      mocks.loadClassifyContext.mockRejectedValue(new Error("DB connection lost"));
      mocks.syncRunUpdate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.SUCCESS }));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.SUCCESS);
      expect(mocks.transactionsSync).toHaveBeenCalled();
    });

    it("stores cycle errors in the success run errorMessage without failing the sync", async () => {
      mocks.transactionsSync.mockResolvedValue({
        data: {
          added: [fakePlaidTransaction("txn_cycle")],
          modified: [],
          removed: [],
          next_cursor: "c2",
          has_more: false,
          request_id: "r5",
        },
      });
      mocks.ensureCycleForDate.mockRejectedValue(new Error("cycle DB error"));
      mocks.syncRunUpdate.mockResolvedValue(fakeSyncRun({ status: SyncRunStatus.SUCCESS }));

      const result = await syncPlaidItem(ITEM_ID, SyncSource.MANUAL);

      expect(result.status).toBe(SyncRunStatus.SUCCESS);
      expect(mocks.syncRunUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            errorMessage: expect.stringContaining("cycle DB error"),
          }),
        })
      );
    });
  });
});

describe("syncAllPlaidItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recoverStuckSyncEntities.mockResolvedValue(undefined);
    mocks.tenantFindMany.mockResolvedValue([{ id: TENANT_ID }]);
    mocks.plaidItemFindMany.mockResolvedValue([]);
  });

  it("runs stuck sync recovery before processing tenants", async () => {
    await syncAllPlaidItems(SyncSource.SCHEDULED);

    expect(mocks.recoverStuckSyncEntities).toHaveBeenCalled();
  });

  it("returns an empty array when no items exist", async () => {
    const results = await syncAllPlaidItems(SyncSource.SCHEDULED);

    expect(results).toEqual([]);
  });

  it("defaults source to SCHEDULED", async () => {
    await syncAllPlaidItems();

    expect(mocks.tenantFindMany).toHaveBeenCalled();
  });
});
