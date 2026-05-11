import { prisma } from "@/lib/prisma";
import { seedCycleDefaultsForTenant } from "@/lib/cycles/seed";

export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;

export async function getSettingsData(tenantId: string) {
  await seedCycleDefaultsForTenant(tenantId);

  const [settings, categories, categoryRules, recurringExpenses, savingsDestinations, settlementPatterns] =
    await Promise.all([
      prisma.userSettings.findUniqueOrThrow({ where: { tenantId } }),
      prisma.category.findMany({
        where: { tenantId },
        orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { name: "asc" }]
      }),
      prisma.categoryRule.findMany({
        where: { tenantId },
        orderBy: [{ priority: "desc" }, { merchantPattern: "asc" }],
        include: { category: { select: { id: true, name: true, color: true } } }
      }),
      prisma.recurringExpense.findMany({
        where: { tenantId },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { category: { select: { id: true, name: true, color: true } } }
      }),
      prisma.savingsDestination.findMany({
        where: { tenantId },
        orderBy: [{ active: "desc" }, { accountName: "asc" }]
      }),
      prisma.settlementPattern.findMany({
        where: { tenantId },
        orderBy: [{ active: "desc" }, { label: "asc" }]
      })
    ]);

  return {
    settings: {
      ...settings,
      defaultFixedSavings: settings.defaultFixedSavings ? Number(settings.defaultFixedSavings.toString()) : null,
      sweepBuffer: Number(settings.sweepBuffer.toString())
    },
    categories,
    categoryRules,
    recurringExpenses: recurringExpenses.map((r) => ({
      ...r,
      amount: Number(r.amount.toString()),
      accrualPerCycle: Number(r.accrualPerCycle.toString())
    })),
    savingsDestinations,
    settlementPatterns
  };
}
