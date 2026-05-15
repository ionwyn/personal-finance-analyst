import { prisma } from "@/lib/prisma";
import { classifyTransaction } from "@/lib/cycles/classify";
import { loadClassifyContext } from "@/lib/cycles/context";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import { recomputeCycleTotals } from "@/lib/cycles/recomputeTotals";

/**
 * Recompute txnType for every transaction in a tenant.
 * Called after the user changes savings destinations, settlement patterns,
 * or the employer pattern.
 *
 * Also backfills cycleId for any transactions still missing it, then
 * re-aggregates incomeReceived / fixedSavingsPull for every cycle touched.
 *
 * Returns the number of rows whose classification actually changed.
 */
export async function reclassifyTenant(tenantId: string) {
  const context = await loadClassifyContext(tenantId);

  const transactions = await prisma.plaidTransaction.findMany({
    where: { tenantId, removed: false },
    select: {
      id: true,
      amount: true,
      merchantName: true,
      name: true,
      categoryPrimary: true,
      categoryDetailed: true,
      date: true,
      txnType: true,
      cycleId: true
    }
  });

  const affectedCycleIds = new Set<string>();
  let updated = 0;

  for (const tx of transactions) {
    const result = classifyTransaction(
      {
        amount: tx.amount,
        merchantName: tx.merchantName,
        name: tx.name,
        categoryPrimary: tx.categoryPrimary,
        categoryDetailed: tx.categoryDetailed,
        date: tx.date,
        existingTxnType: tx.txnType
      },
      context
    );

    let nextCycleId = tx.cycleId;
    if (!nextCycleId) {
      const cycle = await ensureCycleForDate(tenantId, tx.date);
      nextCycleId = cycle.id;
    }

    const classificationChanged = result.txnType !== tx.txnType;
    const cycleChanged = nextCycleId !== tx.cycleId;

    if (!classificationChanged && !cycleChanged) continue;

    await prisma.plaidTransaction.update({
      where: { id: tx.id },
      data: {
        txnType: result.txnType,
        cycleId: nextCycleId
      }
    });

    if (nextCycleId) affectedCycleIds.add(nextCycleId);
    if (tx.cycleId && tx.cycleId !== nextCycleId) affectedCycleIds.add(tx.cycleId);
    updated += 1;
  }

  for (const cycleId of affectedCycleIds) {
    await recomputeCycleTotals(tenantId, cycleId);
  }

  return updated;
}
