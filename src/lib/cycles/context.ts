import { prisma } from "@/lib/prisma";

import type { ClassifyContext } from "@/lib/cycles/classify";

export async function loadClassifyContext(tenantId: string): Promise<ClassifyContext> {
  const [savingsDestinations, settlementPatterns, settings, cycles] = await Promise.all([
    prisma.savingsDestination.findMany({
      where: { tenantId, active: true },
      select: { id: true, matchPattern: true, active: true },
    }),
    prisma.settlementPattern.findMany({
      where: { tenantId, active: true },
      select: { id: true, matchPattern: true, active: true },
    }),
    prisma.userSettings.findUnique({ where: { tenantId } }),
    prisma.payCycle.findMany({
      where: { tenantId },
      select: { startDate: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    savingsDestinations,
    settlementPatterns,
    employerMerchantPattern: settings?.employerMerchantPattern ?? null,
    expectedPaycheckDates: cycles.map((c) => c.startDate),
  };
}
