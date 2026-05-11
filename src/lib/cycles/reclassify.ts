import { prisma } from "@/lib/prisma";
import { classifyTransaction } from "@/lib/cycles/classify";
import { loadClassifyContext } from "@/lib/cycles/context";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import { recomputeCycleTotals } from "@/lib/cycles/recomputeTotals";

/**
 * Recompute txnType + categoryId for every non-manual transaction in a tenant.
 * Called after the user changes category rules, savings destinations, settlement
 * patterns, or the employer pattern. Skips rows where isManuallyCategorized is
 * true.
 *
 * Also backfills cycleId for any transactions still missing it, then
 * re-aggregates incomeReceived / fixedSavingsPull for every cycle touched.
 *
 * Returns the number of rows whose classification actually changed.
 */
export async function reclassifyTenant(tenantId: string) {
  const context = await loadClassifyContext(tenantId);

  const transactions = await prisma.plaidTransaction.findMany({
    where: { tenantId, removed: false, isManuallyCategorized: false },
    select: {
      id: true,
      amount: true,
      merchantName: true,
      name: true,
      date: true,
      txnType: true,
      categoryId: true,
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
        date: tx.date,
        isManuallyCategorized: false,
        existingTxnType: tx.txnType,
        existingCategoryId: tx.categoryId
      },
      context
    );

    let nextCycleId = tx.cycleId;
    if (!nextCycleId) {
      const cycle = await ensureCycleForDate(tenantId, tx.date);
      nextCycleId = cycle.id;
    }

    const classificationChanged =
      result.txnType !== tx.txnType || result.categoryId !== tx.categoryId;
    const cycleChanged = nextCycleId !== tx.cycleId;

    if (!classificationChanged && !cycleChanged) continue;

    await prisma.plaidTransaction.update({
      where: { id: tx.id },
      data: {
        txnType: result.txnType,
        categoryId: result.categoryId,
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
