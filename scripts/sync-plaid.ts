import "dotenv/config";

import { SyncSource } from "@prisma/client";

import { syncAllPlaidItems } from "../src/lib/plaid/sync";

async function main() {
  const runs = await syncAllPlaidItems(SyncSource.SCHEDULED);
  console.log(
    JSON.stringify(
      runs.map((run) => ({
        id: run.id,
        status: run.status,
        source: run.source,
        added: run.addedCount,
        modified: run.modifiedCount,
        removed: run.removedCount,
        error: run.errorCode ?? run.errorMessage,
      })),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
