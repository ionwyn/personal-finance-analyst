import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { fetchAndCacheInstitutionLogo } from "../src/lib/plaid/institution";
import { fetchAndCacheBrokerageLogos } from "../src/lib/snaptrade/brokerage-logos";

async function main() {
  // ── Plaid institution logos (base64 from Plaid API) ──────────────────────
  const plaidItems = await prisma.plaidItem.findMany({
    where: { institutionId: { not: null }, institutionLogo: null },
    select: { id: true, institutionId: true, institutionName: true },
  });

  if (plaidItems.length === 0) {
    console.log("Plaid: all items already have logos cached.");
  } else {
    console.log(`Plaid: fetching logos for ${plaidItems.length} item(s)…`);
    for (const item of plaidItems) {
      process.stdout.write(`  ${item.institutionName ?? item.institutionId} … `);
      await fetchAndCacheInstitutionLogo(item.id, item.institutionId);
      const updated = await prisma.plaidItem.findUnique({
        where: { id: item.id },
        select: { institutionLogo: true },
      });
      console.log(updated?.institutionLogo ? "✓ cached" : "✗ no logo returned");
    }
  }

  // ── SnapTrade brokerage logos (CDN URL from SnapTrade reference data) ────
  const snapConnections = await prisma.snapTradeConnection.findMany({
    where: { brokerageSlug: { not: null }, brokerageLogo: null },
    select: { id: true },
  });

  if (snapConnections.length === 0) {
    console.log("SnapTrade: all connections already have logos cached.");
  } else {
    console.log(`SnapTrade: fetching logos for ${snapConnections.length} connection(s)…`);
    await fetchAndCacheBrokerageLogos();
    const after = await prisma.snapTradeConnection.findMany({
      where: { brokerageSlug: { not: null } },
      select: { brokerageName: true, brokerageSlug: true, brokerageLogo: true },
    });
    for (const conn of after) {
      const label = conn.brokerageName ?? conn.brokerageSlug ?? "?";
      console.log(`  ${label}: ${conn.brokerageLogo ? "✓ " + conn.brokerageLogo : "✗ no logo"}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
