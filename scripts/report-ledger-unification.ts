import "dotenv/config";

import { BrokerLedgerProvider, BrokerLedgerSourceStatus, TenantKind } from "@prisma/client";

import { prisma } from "../src/lib/prisma";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const identifier = argument("tenant");
  const tenant = await prisma.tenant.findFirst({
    where: identifier
      ? { OR: [{ id: identifier }, { slug: identifier }] }
      : { kind: TenantKind.PERSONAL },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const [snapSources, tax, ledgerCount, coverage] = await Promise.all([
    prisma.brokerLedgerSourceRecord.findMany({
      where: { tenantId: tenant.id, provider: BrokerLedgerProvider.SNAPTRADE },
      orderBy: [{ accountId: "asc" }, { tradeDate: "asc" }, { sourceKey: "asc" }],
      select: {
        accountId: true,
        tradeDate: true,
        activityType: true,
        activitySubType: true,
        status: true,
        cashAmount: true,
        ledgerEntryId: true,
      },
    }),
    prisma.brokerLedgerEntry.aggregate({
      where: { tenantId: tenant.id, activityType: "Fee", activitySubType: "TAX" },
      _count: { _all: true },
      _sum: { cashAmount: true },
    }),
    prisma.brokerLedgerEntry.count({ where: { tenantId: tenant.id } }),
    prisma.brokerLedgerCoverage.findMany({
      where: { tenantId: tenant.id },
      include: { account: { select: { name: true, accountCategory: true, rawType: true } } },
      orderBy: { accountId: "asc" },
    }),
  ]);

  const byStatus = new Map<string, number>();
  const report = new Map<
    string,
    { accountId: string; month: string; type: string; count: number; cashCad: number }
  >();
  for (const source of snapSources) {
    byStatus.set(source.status, (byStatus.get(source.status) ?? 0) + 1);
    if (source.status === BrokerLedgerSourceStatus.IGNORED) continue;
    const month = source.tradeDate?.toISOString().slice(0, 7) ?? "unknown";
    const type = `${source.activityType ?? "UNKNOWN"}/${source.activitySubType ?? ""}`;
    const accountId = source.accountId ?? "detached";
    const key = `${accountId}\0${month}\0${type}`;
    const row = report.get(key) ?? { accountId, month, type, count: 0, cashCad: 0 };
    row.count += 1;
    row.cashCad += source.cashAmount?.toNumber() ?? 0;
    report.set(key, row);
  }

  const eligible =
    (byStatus.get(BrokerLedgerSourceStatus.LINKED) ?? 0) +
    (byStatus.get(BrokerLedgerSourceStatus.CONFLICT) ?? 0);
  const ignored = byStatus.get(BrokerLedgerSourceStatus.IGNORED) ?? 0;
  const unclassified =
    snapSources.length - eligible - ignored - (byStatus.get(BrokerLedgerSourceStatus.PENDING) ?? 0);

  console.log("CANONICAL BROKERAGE LEDGER RECONCILIATION");
  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Canonical rows: ${ledgerCount}`);
  console.log(`SnapTrade source rows: ${snapSources.length}`);
  console.log(`  linked: ${byStatus.get(BrokerLedgerSourceStatus.LINKED) ?? 0}`);
  console.log(`  conflicted: ${byStatus.get(BrokerLedgerSourceStatus.CONFLICT) ?? 0}`);
  console.log(`  ignored: ${ignored}`);
  console.log(`  pending: ${byStatus.get(BrokerLedgerSourceStatus.PENDING) ?? 0}`);
  console.log(`Eligible classified: ${eligible}/647`);
  console.log(`Excluded classified: ${ignored}/138`);
  console.log(`Tax: ${tax._count._all}/45 rows, $${tax._sum.cashAmount?.toFixed(2) ?? "0.00"} CAD`);
  console.log(`Unexpected statuses: ${unclassified}`);
  console.log("\nCOVERAGE");
  console.table(
    coverage.map((row) => ({
      account: row.account.accountCategory ?? row.account.rawType ?? row.account.name,
      activityStart: row.activityStartDate?.toISOString().slice(0, 10) ?? null,
      activityEnd: row.activityEndDate?.toISOString().slice(0, 10) ?? null,
      taxStart: row.taxCoverageStartDate?.toISOString().slice(0, 10) ?? null,
      reconciliation: row.reconciliationStatus,
    }))
  );
  console.log("\nACCOUNT / TYPE / MONTH");
  console.table([...report.values()]);

  const pass =
    snapSources.length === 785 &&
    eligible === 647 &&
    ignored === 138 &&
    (byStatus.get(BrokerLedgerSourceStatus.PENDING) ?? 0) === 0 &&
    tax._count._all === 45 &&
    tax._sum.cashAmount?.toFixed(2) === "28.22";
  console.log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
