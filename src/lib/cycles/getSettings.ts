import { subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import { seedCycleDefaultsForTenant } from "@/lib/cycles/seed";
import { formatCategoryName } from "@/lib/spending/category";
import { spendingWhere } from "@/lib/spending/classify";

export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;

export async function getSettingsData(tenantId: string) {
  await seedCycleDefaultsForTenant(tenantId);

  const now = new Date();
  const [
    settings,
    recurringExpenses,
    savingsDestinations,
    settlementPatterns,
    incomeSources,
    budgets,
    savingsGoals,
    spendCategories,
  ] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { tenantId } }),
    prisma.recurringExpense.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.savingsDestination.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { accountName: "asc" }],
    }),
    prisma.settlementPattern.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { label: "asc" }],
    }),
    prisma.incomeSource.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { label: "asc" }],
    }),
    prisma.budget.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { categoryPrimary: "asc" }],
    }),
    prisma.savingsGoal.findMany({
      where: { tenantId },
      include: { savingsDestination: { select: { id: true, label: true, accountName: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    // Categories the tenant actually spends in (last 6 months) — drives the
    // budget category picker so users only budget categories that exist.
    prisma.plaidTransaction.groupBy({
      by: ["categoryPrimary"],
      where: spendingWhere(tenantId, subMonths(now, 6), now),
      _sum: { amount: true },
    }),
  ]);

  const spendingCategories = spendCategories
    .map((r) => r.categoryPrimary)
    .filter((c): c is string => Boolean(c))
    .sort()
    .map((raw) => ({ raw, label: formatCategoryName(raw) }));

  return {
    settings: {
      ...settings,
      defaultFixedSavings: settings.defaultFixedSavings
        ? Number(settings.defaultFixedSavings.toString())
        : null,
      sweepBuffer: Number(settings.sweepBuffer.toString()),
    },
    recurringExpenses: recurringExpenses.map((r) => ({
      ...r,
      amount: Number(r.amount.toString()),
      accrualPerCycle: Number(r.accrualPerCycle.toString()),
    })),
    savingsDestinations,
    settlementPatterns,
    incomeSources,
    budgets: budgets.map((b) => ({
      id: b.id,
      categoryPrimary: b.categoryPrimary,
      categoryLabel: formatCategoryName(b.categoryPrimary),
      amount: Number(b.amount.toString()),
      active: b.active,
    })),
    savingsGoals: savingsGoals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount.toString()),
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      savingsDestinationId: g.savingsDestinationId,
      destinationLabel: g.savingsDestination
        ? (g.savingsDestination.label ?? g.savingsDestination.accountName)
        : null,
      active: g.active,
    })),
    spendingCategories,
  };
}
