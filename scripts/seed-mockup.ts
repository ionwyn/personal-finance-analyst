import "dotenv/config";
import { seedMockupDemo } from "../src/lib/seed/mockup";
import { prisma } from "../src/lib/prisma";

seedMockupDemo()
  .catch((error: Error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
