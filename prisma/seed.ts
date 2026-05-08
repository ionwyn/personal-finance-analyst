import "dotenv/config";

import { getOrCreateDemoTenant } from "../src/lib/tenant";

async function main() {
  await getOrCreateDemoTenant();
  console.log("Seeded base tenants.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
