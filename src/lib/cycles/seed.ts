import { prisma } from "@/lib/prisma";

const DEFAULT_SAVINGS_DESTINATIONS = [
  { accountName: "Wealthsimple", matchPattern: "WEALTHSIMPLE", label: "investing" },
];

const DEFAULT_SETTLEMENT_PATTERNS = [
  { label: "TD Visa payment", matchPattern: "TD VISA PAYMENT" },
  { label: "Credit card payment", matchPattern: "CREDIT CARD PAYMENT" },
  { label: "Remboursement (FR)", matchPattern: "REMBOURSEMENT" },
];

export async function seedCycleDefaultsForTenant(tenantId: string) {
  await prisma.userSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });

  for (const dest of DEFAULT_SAVINGS_DESTINATIONS) {
    const existing = await prisma.savingsDestination.findFirst({
      where: { tenantId, matchPattern: dest.matchPattern },
    });
    if (!existing) {
      await prisma.savingsDestination.create({
        data: { tenantId, ...dest },
      });
    }
  }

  for (const pattern of DEFAULT_SETTLEMENT_PATTERNS) {
    const existing = await prisma.settlementPattern.findFirst({
      where: { tenantId, matchPattern: pattern.matchPattern },
    });
    if (!existing) {
      await prisma.settlementPattern.create({
        data: { tenantId, ...pattern },
      });
    }
  }
}
