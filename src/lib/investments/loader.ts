import { SnapTradeConnectionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  classifySnapTradeAccount,
  isClosedSnapTradeAccountStatus,
} from "@/lib/snaptrade/normalize";
import type {
  ConnectionStatus,
  InvestmentAccount,
  InvestmentCashBalance,
  InvestmentConnection,
  InvestmentPosition,
} from "./types";

const STALE_MS = 24 * 60 * 60 * 1000;

function isStaleSince(iso: string | null | undefined, now: number) {
  if (!iso) return true;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return true;
  return now - ts > STALE_MS;
}

const LOGO_PALETTE = [
  "#a6192e",
  "#0072c6",
  "#1d1d1f",
  "#0d8b3e",
  "#00a4ef",
  "#ed1a3b",
  "#7ab55c",
  "#4285f4",
  "#ff6a00",
  "#76b900",
  "#1f3a93",
  "#003168",
  "#ff9900",
  "#0668e1",
  "#cc0000",
  "#e21c2c",
  "#000000",
];

function hashColor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return LOGO_PALETTE[h % LOGO_PALETTE.length] ?? "#1f3a93";
}

function numberValue(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function nullableNumber(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function logoText(name: string | null | undefined) {
  return (
    (name ?? "ST")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "ST"
  );
}

export type ConnectionHealth = {
  status: ConnectionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  connectionCount: number;
  failingConnectionCount: number;
};

export type LoadedInvestments = {
  accounts: InvestmentAccount[];
  connections: InvestmentConnection[];
  holdings: InvestmentPosition[];
  cashBalances: InvestmentCashBalance[];
  fxUSDtoCAD: number | null;
  omittedPositionCount: number;
  connectionHealth: ConnectionHealth;
  lastRunErrorMessage: string | null;
};

export type InvestmentConnectionSummary = {
  connections: InvestmentConnection[];
  lastSyncAt: string | null;
};

const inFlightLoads = new Map<string, Promise<LoadedInvestments>>();

const STATUS_PRIORITY: Record<ConnectionStatus, number> = {
  ERROR: 4,
  DISABLED: 3,
  SYNCING: 2,
  IDLE: 1,
};

function emptyHealth(): ConnectionHealth {
  return {
    status: "IDLE",
    errorCode: null,
    errorMessage: null,
    connectionCount: 0,
    failingConnectionCount: 0,
  };
}

export async function loadInvestmentConnectionSummary(
  tenantId?: string | null
): Promise<InvestmentConnectionSummary> {
  if (!tenantId) return { connections: [], lastSyncAt: null };

  const [connections, accountsRaw] = await Promise.all([
    prisma.snapTradeConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.snapTradeAccount.findMany({
      where: { tenantId },
      select: {
        connectionId: true,
        status: true,
        holdingsInitialSyncComplete: true,
      },
    }),
  ]);

  const activeAccountsRaw = accountsRaw.filter(
    (account) => !isClosedSnapTradeAccountStatus(account.status)
  );
  const accountsByConnection = new Map<string, { count: number; initialSyncIncomplete: number }>();
  for (const account of activeAccountsRaw) {
    const bucket = accountsByConnection.get(account.connectionId) ?? {
      count: 0,
      initialSyncIncomplete: 0,
    };
    bucket.count += 1;
    if (!account.holdingsInitialSyncComplete) bucket.initialSyncIncomplete += 1;
    accountsByConnection.set(account.connectionId, bucket);
  }

  const now = Date.now();
  const connectionRows: InvestmentConnection[] = connections.map((connection) => {
    const institution = connection.brokerageName ?? connection.name ?? "SnapTrade";
    const bucket = accountsByConnection.get(connection.id) ?? {
      count: 0,
      initialSyncIncomplete: 0,
    };
    const lastSyncAt = connection.lastSyncAt?.toISOString() ?? null;
    return {
      id: connection.id,
      institution,
      institutionLogoBg: hashColor(institution),
      institutionLogoText: logoText(institution),
      status: connection.status as ConnectionStatus,
      lastSyncAt,
      isStale: isStaleSince(lastSyncAt, now),
      errorCode: connection.errorCode,
      errorMessage: connection.errorMessage,
      accountCount: bucket.count,
      initialSyncIncompleteCount: bucket.initialSyncIncomplete,
    };
  });

  const lastSyncAt = connectionRows.reduce<string | null>((acc, connection) => {
    if (!connection.lastSyncAt) return acc;
    if (!acc) return connection.lastSyncAt;
    return connection.lastSyncAt > acc ? connection.lastSyncAt : acc;
  }, null);

  return { connections: connectionRows, lastSyncAt };
}

export async function loadInvestments(tenantId?: string | null): Promise<LoadedInvestments> {
  const key = tenantId ?? "__none__";
  const inFlight = inFlightLoads.get(key);
  if (inFlight) return inFlight;

  const promise = loadInvestmentsUncached(tenantId).finally(() => {
    inFlightLoads.delete(key);
  });
  inFlightLoads.set(key, promise);
  return promise;
}

async function loadInvestmentsUncached(tenantId?: string | null): Promise<LoadedInvestments> {
  if (!tenantId) {
    return {
      accounts: [],
      connections: [],
      holdings: [],
      cashBalances: [],
      fxUSDtoCAD: null,
      omittedPositionCount: 0,
      connectionHealth: emptyHealth(),
      lastRunErrorMessage: null,
    };
  }

  const [accountsRaw, usdCad, lastSyncRun, connections] = await Promise.all([
    prisma.snapTradeAccount.findMany({
      where: { tenantId },
      orderBy: [{ institutionName: "asc" }, { name: "asc" }],
      include: {
        connection: true,
        balances: true,
        positions: {
          orderBy: { marketValueCad: "desc" },
          include: { logo: true },
        },
      },
    }),
    prisma.fxRate.findUnique({ where: { pair: "USD-CAD" } }),
    prisma.snapTradeSyncRun.findFirst({
      where: { tenantId },
      orderBy: { startedAt: "desc" },
    }),
    prisma.snapTradeConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const activeAccountsRaw = accountsRaw.filter(
    (account) => !isClosedSnapTradeAccountStatus(account.status)
  );

  const now = Date.now();

  const accounts: InvestmentAccount[] = activeAccountsRaw.map((account) => {
    const holdingsCAD = account.positions.reduce(
      (sum, position) => sum + numberValue(position.marketValueCad),
      0
    );
    const cashCAD = account.balances.reduce(
      (sum, balance) => sum + numberValue(balance.cashCad),
      0
    );
    const institution = account.institutionName ?? account.connection.brokerageName ?? "SnapTrade";
    const lastSyncAt =
      account.connection.lastSyncAt?.toISOString() ??
      account.lastHoldingsSyncAt?.toISOString() ??
      null;

    const klass = classifySnapTradeAccount(account.unifiedAccountType, account.rawType);
    const netValue = holdingsCAD + cashCAD;
    // A credit card's whole owed balance is a debt; for any other account, a
    // negative cash balance is a loan (e.g. a margin loan). SnapTrade reports
    // both as negative numbers, which we surface here as a positive debt.
    const liabilityCAD = klass.isLiability ? Math.max(0, -netValue) : Math.max(0, -cashCAD);

    return {
      id: account.id,
      connectionId: account.connectionId,
      name: account.name,
      registration: klass.label,
      institution,
      institutionLogoBg: hashColor(institution),
      institutionLogoText: logoText(institution),
      currency: account.currency ?? "CAD",
      totalValue: netValue,
      cash: cashCAD,
      kind: klass.kind,
      isLiability: klass.isLiability,
      isMargin: klass.isMargin,
      liabilityCAD,
      openedAt:
        account.openedAt?.toISOString() ?? account.snapTradeCreatedAt?.toISOString() ?? null,
      lastSyncAt,
      positionCount: account.positions.length,
      status: account.connection.status,
      isStale: isStaleSince(lastSyncAt, now),
      initialSyncComplete: account.holdingsInitialSyncComplete,
      tracked: account.tracked,
    };
  });

  const holdings: InvestmentPosition[] = activeAccountsRaw
    .filter((account) => account.tracked)
    .flatMap((account) =>
      account.positions.map(
        (position): InvestmentPosition => ({
          id: position.id,
          accountId: account.id,
          symbol: position.symbol,
          description: position.description ?? position.symbol,
          type: position.assetType,
          exchange: position.exchange ?? "",
          currency: position.currency,
          units: numberValue(position.units),
          price: numberValue(position.price),
          avgCost: nullableNumber(position.avgCost),
          mvNative: numberValue(position.marketValueNative),
          mvCAD: numberValue(position.marketValueCad),
          costNative: nullableNumber(position.costNative),
          costCAD: nullableNumber(position.costCad),
          plCAD: nullableNumber(position.pnlCad),
          plPct: nullableNumber(position.pnlPct),
          logoBg: hashColor(position.symbol),
          logoId: position.logo?.status === "READY" || position.logoId ? position.logoId : null,
        })
      )
    );

  const cashByCurrency = new Map<string, InvestmentCashBalance>();
  for (const account of activeAccountsRaw) {
    if (!account.tracked) continue;
    for (const balance of account.balances) {
      const existing = cashByCurrency.get(balance.currency);
      const value = numberValue(balance.cash);
      const valueCAD = numberValue(balance.cashCad);
      const buyingPower = numberValue(balance.buyingPower);
      if (existing) {
        existing.value += value;
        existing.valueCAD += valueCAD;
        existing.buyingPower += buyingPower;
      } else {
        cashByCurrency.set(balance.currency, {
          currency: balance.currency,
          value,
          valueCAD,
          buyingPower,
        });
      }
    }
  }

  let worstStatus: ConnectionStatus = "IDLE";
  let firstError: { code: string | null; message: string | null } | null = null;
  let failing = 0;
  for (const connection of connections) {
    const status = connection.status as ConnectionStatus;
    if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worstStatus]) worstStatus = status;
    if (status === SnapTradeConnectionStatus.ERROR) {
      failing += 1;
      if (!firstError) {
        firstError = { code: connection.errorCode, message: connection.errorMessage };
      }
    }
  }

  const connectionHealth: ConnectionHealth = {
    status: worstStatus,
    errorCode: firstError?.code ?? null,
    errorMessage: firstError?.message ?? null,
    connectionCount: connections.length,
    failingConnectionCount: failing,
  };

  const accountsByConnection = new Map<string, { count: number; initialSyncIncomplete: number }>();
  for (const account of activeAccountsRaw) {
    const bucket = accountsByConnection.get(account.connectionId) ?? {
      count: 0,
      initialSyncIncomplete: 0,
    };
    bucket.count += 1;
    if (!account.holdingsInitialSyncComplete) bucket.initialSyncIncomplete += 1;
    accountsByConnection.set(account.connectionId, bucket);
  }

  const connectionRows: InvestmentConnection[] = connections.map((connection) => {
    const institution = connection.brokerageName ?? connection.name ?? "SnapTrade";
    const bucket = accountsByConnection.get(connection.id) ?? {
      count: 0,
      initialSyncIncomplete: 0,
    };
    const lastSyncAt = connection.lastSyncAt?.toISOString() ?? null;
    return {
      id: connection.id,
      institution,
      institutionLogoBg: hashColor(institution),
      institutionLogoText: logoText(institution),
      status: connection.status as ConnectionStatus,
      lastSyncAt,
      isStale: isStaleSince(lastSyncAt, now),
      errorCode: connection.errorCode,
      errorMessage: connection.errorMessage,
      accountCount: bucket.count,
      initialSyncIncompleteCount: bucket.initialSyncIncomplete,
    };
  });

  return {
    accounts,
    connections: connectionRows,
    holdings,
    cashBalances: [...cashByCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    fxUSDtoCAD: usdCad?.rate.toNumber() ?? null,
    omittedPositionCount: lastSyncRun?.omittedPositionsCount ?? 0,
    connectionHealth,
    lastRunErrorMessage: lastSyncRun?.errorMessage ?? null,
  };
}
