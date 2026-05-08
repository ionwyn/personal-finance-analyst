import "dotenv/config";

import { SyncSource } from "@prisma/client";
import { Products as PlaidProducts } from "plaid";

import { getPlaidEnv, getPlaidWebhookUrl } from "../src/lib/env";
import { getPlaidClient } from "../src/lib/plaid/client";
import { refreshBalancesForItem } from "../src/lib/plaid/accounts";
import { syncPlaidItem } from "../src/lib/plaid/sync";
import { exchangeAndStorePlaidItem } from "../src/lib/plaid/items";
import { prisma } from "../src/lib/prisma";
import { getOrCreateDemoTenant } from "../src/lib/tenant";

async function main() {
  if (getPlaidEnv() !== "sandbox") {
    throw new Error("Demo seeding is sandbox-only. Set PLAID_ENV=sandbox.");
  }

  const institutionId = process.argv.find((arg) => arg.startsWith("--institution="))?.split("=")[1] ?? "ins_56";
  const tenant = await getOrCreateDemoTenant();
  const existingItem = await prisma.plaidItem.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" }
  });

  if (existingItem) {
    await syncPlaidItem(existingItem.id, SyncSource.SEED);
    await refreshBalancesForItem(existingItem.id);
    console.log(`Synced existing demo Item ${existingItem.id}.`);
    return;
  }

  const response = await getPlaidClient().sandboxPublicTokenCreate({
    institution_id: institutionId,
    initial_products: [PlaidProducts.Transactions],
    options: {
      webhook: getPlaidWebhookUrl(),
      transactions: {
        days_requested: 730
      }
    }
  });

  const item = await exchangeAndStorePlaidItem({
    tenantId: tenant.id,
    publicToken: response.data.public_token,
    institutionId,
    institutionName: `Sandbox ${institutionId}`,
    source: SyncSource.SEED
  });

  console.log(`Seeded demo Item ${item.id} with ${PlaidProducts.Transactions}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
