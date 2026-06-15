import "dotenv/config";

import { BrokerLedgerIngestionMode } from "@prisma/client";

import {
  backfillCsvSourceRecords,
  canonicalizeSnapTradeActivities,
} from "../src/lib/investments/ledger-sync";
import { prisma } from "../src/lib/prisma";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [{ brokerLedgerEntries: { some: {} } }, { snapTradeActivities: { some: {} } }],
    },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  for (const tenant of tenants) {
    const csv = await backfillCsvSourceRecords(tenant.id);
    const snapTrade = await canonicalizeSnapTradeActivities(tenant.id, {
      mode: BrokerLedgerIngestionMode.MIGRATION,
    });
    console.log(`Migrated canonical brokerage ledger for ${tenant.slug} (${tenant.id})`);
    console.log(
      `  CSV: sources=${csv.sourceCount} inserted=${csv.insertedCount} linked=${csv.linkedCount}`
    );
    console.log(
      `  SnapTrade: sources=${snapTrade.sourceCount} linked=${snapTrade.linkedCount} canonicalized=${snapTrade.canonicalizedCount} ignored=${snapTrade.ignoredCount} conflicts=${snapTrade.conflictCount}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
