import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { getOrCreateDemoTenant } from "../src/lib/tenant";
import { seedCycleDefaultsForTenant } from "../src/lib/cycles/seed";

async function main() {
  await getOrCreateDemoTenant();

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await seedCycleDefaultsForTenant(tenant.id);
  }

  console.log(`Seeded base tenants and cycle defaults for ${tenants.length} tenant(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
