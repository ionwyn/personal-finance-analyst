import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { classifyTransaction } from "../src/lib/cycles/classify";
import { loadClassifyContext } from "../src/lib/cycles/context";
import { closeOverdueCycles } from "../src/lib/cycles/close";
import { ensureCycleForDate, generatePayCycles } from "../src/lib/cycles/generate";
import { recomputeCycleTotals } from "../src/lib/cycles/recomputeTotals";
import { reconcileSweeps } from "../src/lib/cycles/sweepReconcile";
import { seedCycleDefaultsForTenant } from "../src/lib/cycles/seed";

function parseArgAnchor(): Date | null {
  const idx = process.argv.indexOf("--anchor");
  if (idx === -1) return null;
  const raw = process.argv[idx + 1];
  if (!raw) throw new Error("--anchor requires a YYYY-MM-DD value");
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --anchor: ${raw}`);
  return parsed;
}

async function backfillTenant(tenantId: string, cliAnchor: Date | null) {
  await seedCycleDefaultsForTenant(tenantId);

  const settings = await prisma.userSettings.findUnique({ where: { tenantId } });
  const earliest = await prisma.plaidTransaction.findFirst({
    where: { tenantId, removed: false },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  const anchor = cliAnchor ?? settings?.lastPaycheckDate ?? earliest?.date ?? null;
  if (!anchor) {
    console.log(`[${tenantId}] no transactions and no anchor — skipping`);
    return { classified: 0, reconciled: 0 };
  }

  const latest = await prisma.plaidTransaction.findFirst({
    where: { tenantId, removed: false },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const backMonths = earliest ? Math.max(6, monthsBetween(earliest.date, anchor) + 1) : 6;
  const forwardMonths = latest ? Math.max(3, monthsBetween(anchor, latest.date) + 1) : 3;

  await generatePayCycles(tenantId, anchor, { backMonths, forwardMonths });

  const context = await loadClassifyContext(tenantId);

  const transactions = await prisma.plaidTransaction.findMany({
    where: { tenantId, removed: false },
    orderBy: { date: "asc" },
    select: {
      id: true,
      amount: true,
      merchantName: true,
      name: true,
      categoryPrimary: true,
      categoryDetailed: true,
      date: true,
      cycleId: true,
      txnType: true,
    },
  });

  const affectedCycleIds = new Set<string>();
  let classified = 0;

  for (const tx of transactions) {
    const cycle = await ensureCycleForDate(tenantId, tx.date, { anchor });
    affectedCycleIds.add(cycle.id);

    const result = classifyTransaction(
      {
        amount: tx.amount,
        merchantName: tx.merchantName,
        name: tx.name,
        categoryPrimary: tx.categoryPrimary,
        categoryDetailed: tx.categoryDetailed,
        date: tx.date,
        existingTxnType: tx.txnType,
      },
      context
    );

    await prisma.plaidTransaction.update({
      where: { id: tx.id },
      data: {
        cycleId: cycle.id,
        txnType: result.txnType,
      },
    });
    classified += 1;

    if (
      isSameUtcDay(tx.date, cycle.startDate) &&
      (result.txnType === "income" || result.txnType === "savings")
    ) {
      const amountAbs = tx.amount.abs();
      if (result.txnType === "income") {
        await prisma.payCycle.update({
          where: { id: cycle.id },
          data: { incomeReceived: amountAbs },
        });
      } else {
        await prisma.payCycle.update({
          where: { id: cycle.id },
          data: { fixedSavingsPull: amountAbs },
        });
      }
    }
  }

  const reconciled = affectedCycleIds.size
    ? await reconcileSweeps(tenantId, Array.from(affectedCycleIds))
    : 0;

  for (const cycleId of affectedCycleIds) {
    await recomputeCycleTotals(tenantId, cycleId);
  }

  await closeOverdueCycles(tenantId);

  return { classified, reconciled };
}

function monthsBetween(a: Date, b: Date) {
  const years = b.getUTCFullYear() - a.getUTCFullYear();
  const months = b.getUTCMonth() - a.getUTCMonth();
  return Math.abs(years * 12 + months);
}

function isSameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function main() {
  const cliAnchor = parseArgAnchor();
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });

  for (const tenant of tenants) {
    const stats = await backfillTenant(tenant.id, cliAnchor);
    console.log(`[${tenant.slug}] classified=${stats.classified} reconciled=${stats.reconciled}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
