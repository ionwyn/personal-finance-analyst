import "dotenv/config";

import { Prisma, TenantKind } from "@prisma/client";

import { prisma } from "../src/lib/prisma";

const SHARE_TOLERANCE = new Prisma.Decimal("0.01");
const CASH_TOLERANCE = new Prisma.Decimal("0.01");

function parseTenantArgument() {
  const index = process.argv.indexOf("--tenant");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--tenant requires an id or slug");
  return value;
}

async function resolveTenant(identifier: string | null) {
  if (identifier) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant not found: ${identifier}`);
    return tenant;
  }

  const tenants = await prisma.tenant.findMany({
    where: { kind: TenantKind.PERSONAL },
    select: { id: true, slug: true },
  });
  if (tenants.length !== 1) {
    throw new Error(
      `Expected exactly one PERSONAL tenant, found ${tenants.length}; pass --tenant <id-or-slug>`
    );
  }
  return tenants[0]!;
}

function normalizeSymbol(symbol: string | null | undefined) {
  const normalized = symbol?.trim().toUpperCase() ?? "";
  return normalized ? normalized.replace(/\.TO$/, "") : null;
}

function addAmount(amounts: Map<string, Prisma.Decimal>, key: string, amount: Prisma.Decimal) {
  amounts.set(key, (amounts.get(key) ?? new Prisma.Decimal(0)).add(amount));
}

function isUnitAffecting(activityType: string, activitySubType: string | null) {
  return (
    (activityType === "Trade" && (activitySubType === "BUY" || activitySubType === "SELL")) ||
    activityType === "StockDividend" ||
    activityType === "InternalSecurityTransfer" ||
    (activityType === "LegacyCorporateAction" &&
      (activitySubType === "SPLIT" || activitySubType === "NAME_CHANGE"))
  );
}

async function main() {
  const tenant = await resolveTenant(parseTenantArgument());
  const ledger = await prisma.brokerLedgerEntry.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    select: {
      accountId: true,
      activityType: true,
      activitySubType: true,
      symbolNorm: true,
      units: true,
      cashAmount: true,
    },
  });
  if (ledger.length === 0) {
    throw new Error(`No BrokerLedgerEntry rows found for tenant ${tenant.slug}`);
  }

  const accountIds = [
    ...new Set(
      ledger
        .map((entry) => entry.accountId)
        .filter((accountId): accountId is string => Boolean(accountId))
    ),
  ];
  if (accountIds.length === 0 || ledger.some((entry) => !entry.accountId)) {
    throw new Error("Every ledger entry must be mapped to a SnapTrade account");
  }

  const positions = await prisma.snapTradePosition.findMany({
    where: {
      tenantId: tenant.id,
      accountId: { in: accountIds },
    },
    select: {
      symbol: true,
      units: true,
      marketValueCad: true,
    },
  });

  const ledgerUnits = new Map<string, Prisma.Decimal>();
  const currentUnits = new Map<string, Prisma.Decimal>();
  const internalTransferUnits = new Map<string, Prisma.Decimal>();
  const counts = {
    trade: 0,
    split: 0,
    nameChange: 0,
    stockDividend: 0,
    transfer: 0,
  };
  let unitEntries = 0;
  let transferCash = new Prisma.Decimal(0);

  for (const entry of ledger) {
    if (entry.activityType === "MoneyMovement" && entry.activitySubType === "TRANSFER_TF") {
      transferCash = transferCash.add(entry.cashAmount ?? new Prisma.Decimal(0));
    }

    if (!isUnitAffecting(entry.activityType, entry.activitySubType)) continue;
    if (!entry.symbolNorm) {
      throw new Error(`Unit-affecting ledger entry has no normalized symbol`);
    }

    addAmount(ledgerUnits, entry.symbolNorm, entry.units);
    unitEntries += 1;

    if (entry.activityType === "Trade") counts.trade += 1;
    if (entry.activityType === "StockDividend") counts.stockDividend += 1;
    if (entry.activityType === "LegacyCorporateAction" && entry.activitySubType === "SPLIT") {
      counts.split += 1;
    }
    if (entry.activityType === "LegacyCorporateAction" && entry.activitySubType === "NAME_CHANGE") {
      counts.nameChange += 1;
    }
    if (entry.activityType === "InternalSecurityTransfer") {
      counts.transfer += 1;
      addAmount(internalTransferUnits, entry.symbolNorm, entry.units);
    }
  }

  for (const position of positions) {
    const symbol = normalizeSymbol(position.symbol);
    if (symbol) addAmount(currentUnits, symbol, position.units);
  }

  const unmatchedTransfers = [...internalTransferUnits].filter(([, units]) =>
    units.abs().greaterThan(SHARE_TOLERANCE)
  );
  if (transferCash.abs().greaterThan(CASH_TOLERANCE)) {
    throw new Error(`TRANSFER_TF entries do not net to zero: ${transferCash.toString()} CAD`);
  }
  if (unmatchedTransfers.length > 0) {
    throw new Error(
      `InternalSecurityTransfer entries do not net to zero: ${unmatchedTransfers
        .map(([symbol, units]) => `${symbol}=${units.toString()}`)
        .join(", ")}`
    );
  }

  const allSymbols = [...new Set([...ledgerUnits.keys(), ...currentUnits.keys()])].sort();
  const mismatches: Array<{
    symbol: string;
    ledger: Prisma.Decimal;
    current: Prisma.Decimal;
    difference: Prisma.Decimal;
  }> = [];
  let heldReconciled = 0;
  let exitedReconciled = 0;

  for (const symbol of allSymbols) {
    const ledgerAmount = ledgerUnits.get(symbol) ?? new Prisma.Decimal(0);
    const currentAmount = currentUnits.get(symbol) ?? new Prisma.Decimal(0);
    const difference = ledgerAmount.sub(currentAmount);

    if (difference.abs().greaterThan(SHARE_TOLERANCE)) {
      mismatches.push({
        symbol,
        ledger: ledgerAmount,
        current: currentAmount,
        difference,
      });
    } else if (currentAmount.abs().greaterThan(SHARE_TOLERANCE)) {
      heldReconciled += 1;
    } else {
      exitedReconciled += 1;
    }
  }

  const currentNav = positions.reduce(
    (sum, position) => sum.add(position.marketValueCad),
    new Prisma.Decimal(0)
  );
  const currentSymbols = [...currentUnits.values()].filter((units) =>
    units.abs().greaterThan(SHARE_TOLERANCE)
  ).length;

  console.log("=".repeat(68));
  console.log("BROKER LEDGER -> CURRENT HOLDINGS RECONCILIATION");
  console.log("=".repeat(68));
  console.log(`Tenant:                         ${tenant.slug} (${tenant.id})`);
  console.log(`Ledger rows:                    ${ledger.length}`);
  console.log(`Mapped SnapTrade accounts:      ${accountIds.length}`);
  console.log(`Unit-affecting entries applied: ${unitEntries}`);
  console.log(
    `  trades=${counts.trade} splits=${counts.split} name_changes=${counts.nameChange} stock_dividends=${counts.stockDividend} transfers=${counts.transfer}`
  );
  console.log(`Current symbols held:           ${currentSymbols}`);
  console.log(`  reconciled exactly:           ${heldReconciled}`);
  console.log(`Fully-exited symbols (net 0):   ${exitedReconciled}`);
  console.log(`Mismatches (> ${SHARE_TOLERANCE.toString()} shares):       ${mismatches.length}`);
  console.log(
    `Internal transfer guards:      cash=${transferCash.toFixed(2)} CAD, unmatched_symbols=${unmatchedTransfers.length}`
  );
  console.log("-".repeat(68));

  if (mismatches.length > 0) {
    console.log(
      `${"symbol".padEnd(12)}${"ledger".padStart(16)}${"current".padStart(16)}${"diff".padStart(16)}`
    );
    for (const mismatch of mismatches) {
      console.log(
        `${mismatch.symbol.padEnd(12)}${mismatch.ledger.toFixed(6).padStart(16)}${mismatch.current
          .toFixed(6)
          .padStart(16)}${mismatch.difference.toFixed(6).padStart(16)}`
      );
    }
  } else {
    console.log(`PASS: ${heldReconciled}/${currentSymbols} current holdings reconcile.`);
    console.log("PASS: Every fully-exited position nets to zero.");
  }

  console.log("-".repeat(68));
  console.log(`Current NAV (SnapTrade reference): $${currentNav.toFixed(2)}`);
  console.log("=".repeat(68));
  console.log(`RESULT: ${mismatches.length === 0 ? "PASS" : "FAIL"}`);

  if (mismatches.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
