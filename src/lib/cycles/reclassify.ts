import { prisma } from "@/lib/prisma";
import { classifyTransaction } from "@/lib/cycles/classify";
import { loadClassifyContext } from "@/lib/cycles/context";

/**
 * Recompute txnType + categoryId for every non-manual transaction in a tenant.
 * Called after the user changes category rules, savings destinations, settlement
 * patterns, or the employer pattern. Skips rows where isManuallyCategorized is
 * true.
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
      categoryId: true
    }
  });

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

    if (result.txnType === tx.txnType && result.categoryId === tx.categoryId) continue;

    await prisma.plaidTransaction.update({
      where: { id: tx.id },
      data: { txnType: result.txnType, categoryId: result.categoryId }
    });
    updated += 1;
  }

  return updated;
}
