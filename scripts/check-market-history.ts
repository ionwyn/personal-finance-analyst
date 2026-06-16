import "dotenv/config";

import assert from "node:assert/strict";

import { TenantKind } from "@prisma/client";

import { refreshHistoricalPerformance } from "../src/lib/investments/performance-loader";
import { prisma } from "../src/lib/prisma";

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

function finite(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

async function main() {
  const tenant = await resolveTenant(parseTenantArgument());
  const result = await refreshHistoricalPerformance(tenant.id);
  assert(result, `No historical performance data found for tenant ${tenant.slug}`);
  assert.equal(result.lifetimeSymbols, 49, `Expected 49 lifetime symbols`);
  assert.equal(result.resolvedSymbols, 49, `Resolved ${result.resolvedSymbols}/49 symbols`);
  assert.equal(
    result.coverageIssues.length,
    0,
    `Historical coverage issues: ${JSON.stringify(result.coverageIssues)}`
  );
  assert(finite(result.twr["3M"]), "3M TWR is unavailable");
  assert(finite(result.twr["6M"]), "6M TWR is unavailable");
  assert(finite(result.twr["1Y"]), "1Y TWR is unavailable");
  assert(finite(result.twr.ALL), "ALL TWR is unavailable");
  assert(result.twr["1Y"] < 0.446, `1Y TWR is not below the old 44.6% value`);
  assert(finite(result.mwr), "MWR is unavailable");
  assert(result.terminalReconciled, "Terminal reconstructed NAV is outside the 1% tolerance");

  console.log("=".repeat(68));
  console.log("PHASE 3 MARKET HISTORY ACCEPTANCE");
  console.log("=".repeat(68));
  console.log(`Tenant:                       ${tenant.slug} (${tenant.id})`);
  console.log(`Lifetime symbols resolved:    ${result.resolvedSymbols}/${result.lifetimeSymbols}`);
  console.log(`Coverage issues:              ${result.coverageIssues.length}`);
  console.log(`FX source:                    ${result.fxSource}`);
  console.log(`Portfolio inception:          ${result.inceptionDate}`);
  console.log(`3M TWR:                       ${(result.twr["3M"]! * 100).toFixed(6)}%`);
  console.log(`6M TWR:                       ${(result.twr["6M"]! * 100).toFixed(6)}%`);
  console.log(`1Y TWR:                       ${(result.twr["1Y"]! * 100).toFixed(6)}%`);
  console.log(`ALL TWR:                      ${(result.twr.ALL! * 100).toFixed(6)}%`);
  console.log(`All-time MWR/XIRR:            ${(result.mwr! * 100).toFixed(6)}%`);
  console.log(
    `Reconstructed securities:     $${result.terminalSecuritiesValueCad!.toFixed(2)} CAD`
  );
  console.log(`Reconstructed cash:           $${result.terminalCashCad!.toFixed(2)} CAD`);
  console.log(`Reconstructed total NAV:      $${result.terminalValueCad!.toFixed(2)} CAD`);
  console.log(`Synced securities:            $${result.syncedSecuritiesValueCad.toFixed(2)} CAD`);
  console.log(`Synced cash:                  $${result.syncedCashCad.toFixed(2)} CAD`);
  console.log(`Synced total NAV:             $${result.syncedValueCad.toFixed(2)} CAD`);
  console.log(`Cash difference:              $${result.cashDifferenceCad!.toFixed(2)} CAD`);
  console.log(
    `Terminal difference:          $${result.terminalDifferenceCad!.toFixed(2)} CAD (${result.terminalDifferencePct!.toFixed(4)}%)`
  );
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
