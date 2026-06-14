import "dotenv/config";

import assert from "node:assert/strict";

import { Prisma, TenantKind } from "@prisma/client";

import {
  calendarDate,
  externalFlows,
  isUnitAffectingEntry,
  mwr,
  mwrNpv,
  reconstructDailyCash,
  reconstructDailyHoldings,
} from "../src/lib/investments/performance";
import { prisma } from "../src/lib/prisma";

const SHARE_TOLERANCE = 0.01;
const NPV_TOLERANCE_CAD = 0.0001;

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

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\.TO$/, "");
}

async function main() {
  const tenant = await resolveTenant(parseTenantArgument());
  const ledger = await prisma.brokerLedgerEntry.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    select: {
      tradeDate: true,
      activityType: true,
      activitySubType: true,
      symbolNorm: true,
      units: true,
      cashAmount: true,
      accountId: true,
    },
  });
  assert(ledger.length > 0, `No BrokerLedgerEntry rows found for tenant ${tenant.slug}`);
  assert(
    ledger.every((entry) => entry.accountId),
    "Every ledger entry must be mapped to a SnapTrade account"
  );

  const endDate = calendarDate(new Date());
  const holdings = reconstructDailyHoldings(ledger, endDate);
  const cash = reconstructDailyCash(ledger, endDate);
  const finalUnits = holdings.at(-1)?.units ?? {};
  const lifetimeSymbols = new Set(
    ledger
      .filter(isUnitAffectingEntry)
      .map((entry) => entry.symbolNorm)
      .filter((symbol): symbol is string => Boolean(symbol))
  );

  const accountIds = [
    ...new Set(ledger.map((entry) => entry.accountId).filter((id): id is string => Boolean(id))),
  ];
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

  const currentUnits = new Map<string, number>();
  for (const position of positions) {
    const symbol = normalizeSymbol(position.symbol);
    currentUnits.set(symbol, (currentUnits.get(symbol) ?? 0) + position.units.toNumber());
  }

  const comparedSymbols = new Set([...Object.keys(finalUnits), ...currentUnits.keys()]);
  const mismatches = [...comparedSymbols]
    .map((symbol) => {
      const reconstructed = finalUnits[symbol] ?? 0;
      const current = currentUnits.get(symbol) ?? 0;
      return { symbol, reconstructed, current, difference: reconstructed - current };
    })
    .filter((entry) => Math.abs(entry.difference) > SHARE_TOLERANCE);

  const heldSymbols = [...currentUnits.values()].filter(
    (units) => Math.abs(units) > SHARE_TOLERANCE
  ).length;
  const exitedSymbols = [...lifetimeSymbols].filter(
    (symbol) => Math.abs(finalUnits[symbol] ?? 0) <= SHARE_TOLERANCE
  ).length;

  const eftRows = ledger.filter(
    (entry) => entry.activityType === "MoneyMovement" && entry.activitySubType === "EFT"
  );
  const flows = externalFlows(ledger);
  const terminalSecuritiesValueCad = positions
    .reduce((sum, position) => sum.add(position.marketValueCad), new Prisma.Decimal(0))
    .toNumber();
  const terminalCashCad = cash.at(-1)?.cashCad ?? 0;
  const terminalValueCad = terminalSecuritiesValueCad + terminalCashCad;
  const syncedCashCad =
    (
      await prisma.snapTradeCashBalance.aggregate({
        where: { tenantId: tenant.id, accountId: { in: accountIds } },
        _sum: { cashCad: true },
      })
    )._sum.cashCad?.toNumber() ?? 0;
  const rate = mwr(flows, terminalValueCad, endDate);
  const residual = rate == null ? null : mwrNpv(flows, terminalValueCad, endDate, rate);

  assert.equal(mismatches.length, 0, `Holdings mismatches: ${JSON.stringify(mismatches)}`);
  assert.equal(heldSymbols, 33, `Expected 33 current symbols, found ${heldSymbols}`);
  assert.equal(exitedSymbols, 16, `Expected 16 fully-exited symbols, found ${exitedSymbols}`);
  assert.equal(eftRows.length, 176, `Expected 176 EFT rows, found ${eftRows.length}`);
  assert.equal(flows.length, 162, `Expected 162 EFT date aggregates, found ${flows.length}`);
  assert(rate != null && Number.isFinite(rate), "Real-ledger MWR did not produce a unique root");
  assert(
    residual != null && Math.abs(residual) <= NPV_TOLERANCE_CAD,
    `MWR NPV residual exceeds tolerance: ${residual}`
  );

  console.log("=".repeat(68));
  console.log("PHASE 2 PERFORMANCE ENGINE ACCEPTANCE");
  console.log("=".repeat(68));
  console.log(`Tenant:                       ${tenant.slug} (${tenant.id})`);
  console.log(`Ledger rows:                  ${ledger.length}`);
  console.log(`Daily holdings snapshots:     ${holdings.length}`);
  console.log(`Current holdings reconciled:  ${heldSymbols}/${heldSymbols}`);
  console.log(`Fully-exited symbols:         ${exitedSymbols}`);
  console.log(`Unit mismatches:              ${mismatches.length}`);
  console.log(`EFT source rows:              ${eftRows.length}`);
  console.log(`EFT date aggregates:          ${flows.length}`);
  console.log(`Terminal securities NAV:      $${terminalSecuritiesValueCad.toFixed(2)} CAD`);
  console.log(`Transaction-derived cash:     $${terminalCashCad.toFixed(2)} CAD`);
  console.log(`Synced cash snapshot:         $${syncedCashCad.toFixed(2)} CAD`);
  console.log(`Terminal total NAV:           $${terminalValueCad.toFixed(2)} CAD`);
  console.log(`All-time MWR/XIRR:            ${(rate * 100).toFixed(6)}%`);
  console.log(`XIRR NPV residual:            ${residual!.toExponential(3)} CAD`);
  console.log("-".repeat(68));
  console.log("RESULT: PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
