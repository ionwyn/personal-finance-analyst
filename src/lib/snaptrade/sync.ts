import { Prisma, SnapTradeConnectionStatus, SyncRunStatus, SyncSource } from "@prisma/client";
import type { Account, Balance, BrokerageAuthorization, Position } from "snaptrade-typescript-sdk";

import { prisma } from "@/lib/prisma";
import { getFxRate } from "@/lib/fx/rates";
import { ensureLogoRecord } from "@/lib/snaptrade/logo";
import {
  isClosedSnapTradeAccountStatus,
  normalizeAccount,
  normalizeBalance,
  normalizeConnection,
  normalizePosition,
} from "@/lib/snaptrade/normalize";
import { getSnapTradeClient, getSnapTradeCredentials } from "@/lib/snaptrade/client";
import {
  elapsedMs,
  ensureRequestId,
  logger,
  normalizeSyncSource,
  safeError,
  withLogContext,
} from "@/lib/logger";

const ACTIVE_LOCK_MS = 15 * 60 * 1000;

function decimal(value: number | null | undefined) {
  return value == null ? null : new Prisma.Decimal(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "SnapTrade sync failed.";
}

async function ensureConnectionRecord(input: {
  tenantId: string;
  authorization: BrokerageAuthorization;
}) {
  const normalized = normalizeConnection(input.authorization);
  if (!normalized) return null;

  return prisma.snapTradeConnection.upsert({
    where: { snapTradeAuthorizationId: normalized.snapTradeAuthorizationId },
    update: {
      tenantId: input.tenantId,
      name: normalized.name,
      type: normalized.type,
      brokerageName: normalized.brokerageName,
      brokerageSlug: normalized.brokerageSlug,
      disabled: normalized.disabled,
      disabledAt: normalized.disabledAt,
    },
    create: {
      tenantId: input.tenantId,
      snapTradeAuthorizationId: normalized.snapTradeAuthorizationId,
      name: normalized.name,
      type: normalized.type,
      brokerageName: normalized.brokerageName,
      brokerageSlug: normalized.brokerageSlug,
      disabled: normalized.disabled,
      disabledAt: normalized.disabledAt,
      status: normalized.disabled
        ? SnapTradeConnectionStatus.DISABLED
        : SnapTradeConnectionStatus.IDLE,
    },
  });
}

async function recoverStuckSnapTradeSyncRuns() {
  const cutoff = new Date(Date.now() - ACTIVE_LOCK_MS);

  await prisma.snapTradeSyncRun.updateMany({
    where: { status: SyncRunStatus.RUNNING, startedAt: { lt: cutoff } },
    data: {
      status: SyncRunStatus.ERROR,
      completedAt: new Date(),
      errorCode: "STUCK_SYNC_RECOVERY",
      errorMessage: "SnapTrade sync run was stuck in RUNNING state and was reset by the watchdog.",
    },
  });

  await prisma.snapTradeConnection.updateMany({
    where: { status: SnapTradeConnectionStatus.SYNCING, updatedAt: { lt: cutoff } },
    data: {
      status: SnapTradeConnectionStatus.ERROR,
      errorCode: "STUCK_SYNC_RECOVERY",
      errorMessage:
        "SnapTrade connection was stuck in SYNCING state and was reset by the watchdog.",
    },
  });
}

async function upsertAccount(input: { tenantId: string; connectionId: string; account: Account }) {
  const normalized = normalizeAccount(input.account);
  return prisma.snapTradeAccount.upsert({
    where: { snapTradeAccountId: normalized.snapTradeAccountId },
    update: {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      name: normalized.name,
      institutionName: normalized.institutionName,
      rawType: normalized.rawType,
      accountCategory: normalized.accountCategory,
      currency: normalized.currency,
      totalValue: decimal(normalized.totalValue),
      openedAt: normalized.openedAt,
      snapTradeCreatedAt: normalized.snapTradeCreatedAt,
      status: normalized.status,
      isPaper: normalized.isPaper,
      lastHoldingsSyncAt: normalized.lastHoldingsSyncAt,
      holdingsInitialSyncComplete: normalized.holdingsInitialSyncComplete,
    },
    create: {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      snapTradeAccountId: normalized.snapTradeAccountId,
      name: normalized.name,
      institutionName: normalized.institutionName,
      rawType: normalized.rawType,
      accountCategory: normalized.accountCategory,
      currency: normalized.currency,
      totalValue: decimal(normalized.totalValue),
      openedAt: normalized.openedAt,
      snapTradeCreatedAt: normalized.snapTradeCreatedAt,
      status: normalized.status,
      isPaper: normalized.isPaper,
      lastHoldingsSyncAt: normalized.lastHoldingsSyncAt,
      holdingsInitialSyncComplete: normalized.holdingsInitialSyncComplete,
    },
  });
}

async function syncBalances(input: { tenantId: string; accountId: string; balances: Balance[] }) {
  const seen = new Set<string>();
  let balancesCount = 0;

  for (const balance of input.balances) {
    const normalized = normalizeBalance(balance);
    if (!normalized) continue;

    const fxRate = await getFxRate(normalized.currency, "CAD");
    await prisma.snapTradeCashBalance.upsert({
      where: {
        accountId_currency: {
          accountId: input.accountId,
          currency: normalized.currency,
        },
      },
      update: {
        tenantId: input.tenantId,
        cash: new Prisma.Decimal(normalized.cash),
        buyingPower: decimal(normalized.buyingPower),
        cashCad: new Prisma.Decimal(normalized.cash * fxRate),
      },
      create: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        currency: normalized.currency,
        cash: new Prisma.Decimal(normalized.cash),
        buyingPower: decimal(normalized.buyingPower),
        cashCad: new Prisma.Decimal(normalized.cash * fxRate),
      },
    });

    seen.add(normalized.currency);
    balancesCount += 1;
  }

  await prisma.snapTradeCashBalance.deleteMany({
    where: {
      accountId: input.accountId,
      currency: { notIn: [...seen] },
    },
  });

  return balancesCount;
}

async function syncPositions(input: {
  tenantId: string;
  accountId: string;
  positions: Position[];
}) {
  const seenIds: string[] = [];
  let positionsCount = 0;
  let omittedPositionsCount = 0;

  for (const [index, position] of input.positions.entries()) {
    const normalized = normalizePosition(position, index);
    if (!normalized) {
      omittedPositionsCount += 1;
      continue;
    }

    const fxRate = await getFxRate(normalized.currency, "CAD");
    const logoId = await ensureLogoRecord(normalized.logoUrl);
    const marketValueCad = normalized.marketValueNative * fxRate;
    const costCad = normalized.costNative == null ? null : normalized.costNative * fxRate;
    const pnlCad = normalized.pnlNative == null ? null : normalized.pnlNative * fxRate;

    const saved = await prisma.snapTradePosition.upsert({
      where: {
        accountId_symbol_currency: {
          accountId: input.accountId,
          symbol: normalized.symbol,
          currency: normalized.currency,
        },
      },
      update: {
        tenantId: input.tenantId,
        snapTradeSymbolId: normalized.snapTradeSymbolId,
        rawSymbol: normalized.rawSymbol,
        description: normalized.description,
        assetType: normalized.assetType,
        exchange: normalized.exchange,
        units: new Prisma.Decimal(normalized.units),
        price: decimal(normalized.price),
        avgCost: decimal(normalized.avgCost),
        marketValueNative: new Prisma.Decimal(normalized.marketValueNative),
        marketValueCad: new Prisma.Decimal(marketValueCad),
        costNative: decimal(normalized.costNative),
        costCad: decimal(costCad),
        pnlCad: decimal(pnlCad),
        pnlPct: decimal(normalized.pnlPct),
        cashEquivalent: normalized.cashEquivalent,
        logoId: logoId ?? undefined,
      },
      create: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        snapTradeSymbolId: normalized.snapTradeSymbolId,
        symbol: normalized.symbol,
        rawSymbol: normalized.rawSymbol,
        description: normalized.description,
        assetType: normalized.assetType,
        exchange: normalized.exchange,
        currency: normalized.currency,
        units: new Prisma.Decimal(normalized.units),
        price: decimal(normalized.price),
        avgCost: decimal(normalized.avgCost),
        marketValueNative: new Prisma.Decimal(normalized.marketValueNative),
        marketValueCad: new Prisma.Decimal(marketValueCad),
        costNative: decimal(normalized.costNative),
        costCad: decimal(costCad),
        pnlCad: decimal(pnlCad),
        pnlPct: decimal(normalized.pnlPct),
        cashEquivalent: normalized.cashEquivalent,
        logoId,
      },
    });

    seenIds.push(saved.id);
    positionsCount += 1;
  }

  await prisma.snapTradePosition.deleteMany({
    where: {
      accountId: input.accountId,
      id: { notIn: seenIds },
    },
  });

  return { positionsCount, omittedPositionsCount };
}

async function syncConnection(input: {
  tenantId: string;
  authorization: BrokerageAuthorization;
  source?: SyncSource;
}) {
  const client = getSnapTradeClient();
  const { userId, userSecret } = getSnapTradeCredentials();
  const connection = await ensureConnectionRecord({
    tenantId: input.tenantId,
    authorization: input.authorization,
  });

  if (!connection) {
    return {
      accountsCount: 0,
      balancesCount: 0,
      positionsCount: 0,
      omittedPositionsCount: 0,
      skipped: false,
    };
  }

  const startedAt = performance.now();
  logger.info({ connectionId: connection.id }, "snaptrade connection sync started");

  if (connection.disabled) {
    await prisma.snapTradeConnection.update({
      where: { id: connection.id },
      data: { status: SnapTradeConnectionStatus.DISABLED },
    });
    logger.info(
      {
        duration: elapsedMs(startedAt),
        connectionId: connection.id,
        status: SnapTradeConnectionStatus.DISABLED,
      },
      "snaptrade connection sync skipped"
    );
    return {
      accountsCount: 0,
      balancesCount: 0,
      positionsCount: 0,
      omittedPositionsCount: 0,
      skipped: false,
    };
  }

  const stale = new Date(Date.now() - ACTIVE_LOCK_MS);
  const lockResult = await prisma.snapTradeConnection.updateMany({
    where: {
      id: connection.id,
      OR: [
        { status: { in: [SnapTradeConnectionStatus.IDLE, SnapTradeConnectionStatus.ERROR] } },
        { status: SnapTradeConnectionStatus.SYNCING, updatedAt: { lt: stale } },
      ],
    },
    data: {
      status: SnapTradeConnectionStatus.SYNCING,
      errorCode: null,
      errorMessage: null,
    },
  });

  if (lockResult.count === 0) {
    logger.info(
      {
        duration: elapsedMs(startedAt),
        connectionId: connection.id,
        status: SyncRunStatus.SKIPPED,
      },
      "snaptrade connection sync skipped"
    );
    return {
      accountsCount: 0,
      balancesCount: 0,
      positionsCount: 0,
      omittedPositionsCount: 0,
      skipped: true,
    };
  }

  try {
    if (input.source === SyncSource.MANUAL) {
      try {
        await client.connections.refreshBrokerageAuthorization({
          authorizationId: connection.snapTradeAuthorizationId,
          userId,
          userSecret,
        });
      } catch (refreshError) {
        logger.warn(
          { connectionId: connection.id, error: safeError(refreshError) },
          "snaptrade broker refresh failed (non-fatal)"
        );
      }
    }

    const accountsResponse = await client.connections.listBrokerageAuthorizationAccounts({
      authorizationId: connection.snapTradeAuthorizationId,
      userId,
      userSecret,
    });

    let accountsCount = 0;
    let balancesCount = 0;
    let positionsCount = 0;
    let omittedPositionsCount = 0;
    const seenAccountIds: string[] = [];

    for (const account of accountsResponse.data) {
      const normalizedAccount = normalizeAccount(account);
      if (isClosedSnapTradeAccountStatus(normalizedAccount.status)) {
        continue;
      }

      const savedAccount = await upsertAccount({
        tenantId: input.tenantId,
        connectionId: connection.id,
        account,
      });
      seenAccountIds.push(savedAccount.id);
      accountsCount += 1;

      const balancesResponse = await client.accountInformation.getUserAccountBalance({
        accountId: account.id,
        userId,
        userSecret,
      });
      balancesCount += await syncBalances({
        tenantId: input.tenantId,
        accountId: savedAccount.id,
        balances: balancesResponse.data,
      });

      const positionsResponse = await client.accountInformation.getUserAccountPositions({
        accountId: account.id,
        userId,
        userSecret,
      });
      const positionCounts = await syncPositions({
        tenantId: input.tenantId,
        accountId: savedAccount.id,
        positions: positionsResponse.data,
      });
      positionsCount += positionCounts.positionsCount;
      omittedPositionsCount += positionCounts.omittedPositionsCount;
    }

    await prisma.snapTradeAccount.deleteMany({
      where: {
        connectionId: connection.id,
        id: { notIn: seenAccountIds },
      },
    });

    await prisma.snapTradeConnection.update({
      where: { id: connection.id },
      data: {
        status: SnapTradeConnectionStatus.IDLE,
        lastSyncAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });

    logger.info(
      {
        duration: elapsedMs(startedAt),
        connectionId: connection.id,
        accountsCount,
        balancesCount,
        positionsCount,
        omittedPositionsCount,
      },
      "snaptrade connection sync completed"
    );
    return { accountsCount, balancesCount, positionsCount, omittedPositionsCount, skipped: false };
  } catch (error) {
    await prisma.snapTradeConnection.update({
      where: { id: connection.id },
      data: {
        status: SnapTradeConnectionStatus.ERROR,
        errorCode: "SNAPTRADE_SYNC_ERROR",
        errorMessage: errorMessage(error),
      },
    });
    logger.error(
      {
        duration: elapsedMs(startedAt),
        connectionId: connection.id,
        errorCode: "SNAPTRADE_SYNC_ERROR",
        error: safeError(error),
      },
      "snaptrade connection sync failed"
    );
    throw error;
  }
}

export async function syncSnapTradeTenant(
  tenantId: string,
  source: SyncSource = SyncSource.MANUAL
) {
  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "snaptrade",
      tenantId,
      syncSource: normalizeSyncSource(source),
    },
    async () => syncSnapTradeTenantWithContext(tenantId, source)
  );
}

async function syncSnapTradeTenantWithContext(tenantId: string, source: SyncSource) {
  const startedAt = performance.now();
  logger.info("snaptrade tenant sync started");

  await recoverStuckSnapTradeSyncRuns();

  const activeRun = await prisma.snapTradeSyncRun.findFirst({
    where: {
      tenantId,
      status: SyncRunStatus.RUNNING,
      startedAt: { gte: new Date(Date.now() - ACTIVE_LOCK_MS) },
    },
  });

  if (activeRun) {
    const skippedRun = await prisma.snapTradeSyncRun.create({
      data: {
        tenantId,
        source,
        status: SyncRunStatus.SKIPPED,
        completedAt: new Date(),
        errorMessage: "Skipped: another SnapTrade sync is in progress.",
      },
    });
    logger.info(
      {
        duration: elapsedMs(startedAt),
        status: skippedRun.status,
      },
      "snaptrade tenant sync skipped"
    );
    return skippedRun;
  }

  const run = await prisma.snapTradeSyncRun.create({
    data: {
      tenantId,
      source,
      status: SyncRunStatus.RUNNING,
    },
  });

  let connectionsCount = 0;
  let accountsCount = 0;
  let balancesCount = 0;
  let positionsCount = 0;
  let omittedPositionsCount = 0;
  let skippedConnections = 0;

  try {
    const { userId, userSecret } = getSnapTradeCredentials();
    const authorizations = await getSnapTradeClient().connections.listBrokerageAuthorizations({
      userId,
      userSecret,
    });

    const authorizationIds = authorizations.data
      .map((authorization) => authorization.id)
      .filter((id): id is string => Boolean(id));

    for (const authorization of authorizations.data) {
      const counts = await syncConnection({ tenantId, authorization, source });
      connectionsCount += 1;
      accountsCount += counts.accountsCount;
      balancesCount += counts.balancesCount;
      positionsCount += counts.positionsCount;
      omittedPositionsCount += counts.omittedPositionsCount;
      if (counts.skipped) skippedConnections += 1;
    }

    await prisma.snapTradeConnection.updateMany({
      where: {
        tenantId,
        snapTradeAuthorizationId: { notIn: authorizationIds },
      },
      data: {
        disabled: true,
        status: SnapTradeConnectionStatus.DISABLED,
      },
    });

    const updatedRun = await prisma.snapTradeSyncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.SUCCESS,
        completedAt: new Date(),
        connectionsCount,
        accountsCount,
        balancesCount,
        positionsCount,
        omittedPositionsCount,
        errorMessage: skippedConnections
          ? `${skippedConnections} connection(s) skipped: another sync was in progress.`
          : null,
      },
    });
    logger.info(
      {
        duration: elapsedMs(startedAt),
        status: updatedRun.status,
        connectionsCount,
        accountsCount,
        balancesCount,
        positionsCount,
        omittedPositionsCount,
        skippedConnections,
      },
      "snaptrade tenant sync completed"
    );
    return updatedRun;
  } catch (error) {
    const updatedRun = await prisma.snapTradeSyncRun.update({
      where: { id: run.id },
      data: {
        status: SyncRunStatus.ERROR,
        completedAt: new Date(),
        connectionsCount,
        accountsCount,
        balancesCount,
        positionsCount,
        omittedPositionsCount,
        errorCode: "SNAPTRADE_SYNC_ERROR",
        errorMessage: errorMessage(error),
      },
    });
    logger.error(
      {
        duration: elapsedMs(startedAt),
        status: updatedRun.status,
        connectionsCount,
        accountsCount,
        balancesCount,
        positionsCount,
        omittedPositionsCount,
        errorCode: "SNAPTRADE_SYNC_ERROR",
        error: safeError(error),
      },
      "snaptrade tenant sync failed"
    );
    return updatedRun;
  }
}

export async function syncAllSnapTradeTenants(source: SyncSource = SyncSource.SCHEDULED) {
  await recoverStuckSnapTradeSyncRuns();

  const tenants = await prisma.tenant.findMany({
    where: { snapTradeConnections: { some: {} } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const tenant of tenants) {
    results.push(await syncSnapTradeTenant(tenant.id, source));
  }
  return results;
}

export async function refreshSnapTradeConnection(input: {
  tenantId: string;
  connectionId: string;
}) {
  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "snaptrade",
      tenantId: input.tenantId,
      syncSource: normalizeSyncSource(SyncSource.MANUAL),
    },
    async () => {
      const startedAt = performance.now();
      logger.info({ connectionId: input.connectionId }, "snaptrade connection refresh started");

      try {
        const connection = await prisma.snapTradeConnection.findFirst({
          where: {
            id: input.connectionId,
            tenantId: input.tenantId,
          },
        });
        if (!connection) throw new Error("SnapTrade connection not found.");

        const { userId, userSecret } = getSnapTradeCredentials();
        const response = await getSnapTradeClient().connections.refreshBrokerageAuthorization({
          authorizationId: connection.snapTradeAuthorizationId,
          userId,
          userSecret,
        });

        await prisma.snapTradeConnection.update({
          where: { id: connection.id },
          data: { lastManualRefreshAt: new Date() },
        });

        logger.info(
          {
            duration: elapsedMs(startedAt),
            connectionId: connection.id,
          },
          "snaptrade connection refresh completed"
        );
        return response.data;
      } catch (error) {
        logger.error(
          {
            duration: elapsedMs(startedAt),
            connectionId: input.connectionId,
            error: safeError(error),
          },
          "snaptrade connection refresh failed"
        );
        throw error;
      }
    }
  );
}

export async function removeSnapTradeConnection(input: { tenantId: string; connectionId: string }) {
  return withLogContext(
    {
      requestId: ensureRequestId(),
      provider: "snaptrade",
      tenantId: input.tenantId,
    },
    async () => {
      const startedAt = performance.now();
      logger.info({ connectionId: input.connectionId }, "snaptrade connection remove started");

      try {
        const connection = await prisma.snapTradeConnection.findFirst({
          where: {
            id: input.connectionId,
            tenantId: input.tenantId,
          },
        });
        if (!connection) throw new Error("SnapTrade connection not found.");

        const { userId, userSecret } = getSnapTradeCredentials();
        await getSnapTradeClient().connections.removeBrokerageAuthorization({
          authorizationId: connection.snapTradeAuthorizationId,
          userId,
          userSecret,
        });

        await prisma.snapTradeConnection.delete({ where: { id: connection.id } });

        logger.info(
          {
            duration: elapsedMs(startedAt),
            connectionId: connection.id,
          },
          "snaptrade connection remove completed"
        );
      } catch (error) {
        logger.error(
          {
            duration: elapsedMs(startedAt),
            connectionId: input.connectionId,
            error: safeError(error),
          },
          "snaptrade connection remove failed"
        );
        throw error;
      }
    }
  );
}
