import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { closeOverdueCycles, getActiveCarryover } from "@/lib/cycles/close";
import { computeSafeToSweep, type SafeToSweepResult } from "@/lib/cycles/safeToSweep";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import {
  findPreviousCycleId,
  getSpendingBreakdown,
  type SpendingBreakdownData
} from "@/lib/cycles/getSpendingBreakdown";

export type CommittedStatus = "debited" | "accrued" | "upcoming";

export type CommittedItem = {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  accrualPerCycle: Prisma.Decimal;
  frequency: string;
  status: CommittedStatus;
  matchedTransactionId: string | null;
};

export type CurrentCycleData = {
  cycle: {
    id: string;
    startDate: Date;
    endDate: Date;
    incomeReceived: Prisma.Decimal | null;
    fixedSavingsPull: Prisma.Decimal | null;
    sweptAmount: Prisma.Decimal | null;
    creditCardPaymentDate: Date | null;
    notes: string | null;
  };
  daysRemaining: number;
  committed: CommittedItem[];
  committedTotalAccrued: Prisma.Decimal;
  spentSoFar: Prisma.Decimal;
  pendingSum: Prisma.Decimal;
  pendingCount: number;
  carryover: Prisma.Decimal;
  chequingBalance: Prisma.Decimal;
  creditCardBalance: Prisma.Decimal;
  creditCardBalanceInCycle: Prisma.Decimal;
  sweepBuffer: Prisma.Decimal;
  safeToSweep: SafeToSweepResult;
  settingsConfigured: boolean;
  breakdown: SpendingBreakdownData;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ccPaymentDateInCycle(
  start: Date,
  end: Date,
  ccPaymentDayOfMonth: number | null | undefined
): Date | null {
  if (!ccPaymentDayOfMonth) return null;
  const startYM = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endYM = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (let cursor = startYM; cursor <= endYM; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(ccPaymentDayOfMonth, lastOfMonth);
    const candidate = new Date(Date.UTC(year, month, day));
    if (candidate >= startOfUtcDay(start) && candidate <= startOfUtcDay(end)) {
      return candidate;
    }
  }
  return null;
}

export async function getCurrentCycleData(tenantId: string, now: Date = new Date()): Promise<CurrentCycleData | null> {
  await closeOverdueCycles(tenantId, now);

  const cycle = await ensureCycleForDate(tenantId, now);

  const settings = await prisma.userSettings.findUnique({ where: { tenantId } });
  const settingsConfigured = Boolean(settings?.lastPaycheckDate);

  const accounts = await prisma.plaidAccount.findMany({
    where: { tenantId },
    select: { id: true, type: true, subtype: true, currentBalance: true }
  });

  let chequingBalance = new Prisma.Decimal(0);
  let creditCardBalance = new Prisma.Decimal(0);
  for (const acct of accounts) {
    const bal = acct.currentBalance ?? new Prisma.Decimal(0);
    if (acct.type === "depository") {
      chequingBalance = chequingBalance.add(bal);
    } else if (acct.type === "credit") {
      creditCardBalance = creditCardBalance.add(bal);
    }
  }

  const ccDate = ccPaymentDateInCycle(cycle.startDate, cycle.endDate, settings?.ccPaymentDayOfMonth ?? null);
  const creditCardBalanceInCycle = ccDate ? creditCardBalance : new Prisma.Decimal(0);

  const cycleTxAgg = await prisma.plaidTransaction.groupBy({
    by: ["txnType"],
    where: {
      tenantId,
      cycleId: cycle.id,
      removed: false,
      supersededById: null
    },
    _sum: { amount: true }
  });

  const expenseAll = cycleTxAgg.find((row) => row.txnType === "expense")?._sum.amount ?? new Prisma.Decimal(0);
  const pendingAgg = await prisma.plaidTransaction.aggregate({
    where: {
      tenantId,
      cycleId: cycle.id,
      removed: false,
      supersededById: null,
      txnType: "expense",
      pending: true
    },
    _sum: { amount: true },
    _count: { _all: true }
  });
  const pendingSum = pendingAgg._sum.amount ?? new Prisma.Decimal(0);
  const pendingCount = pendingAgg._count._all;

  const recurring = await prisma.recurringExpense.findMany({
    where: { tenantId, active: true, confirmed: true },
    select: {
      id: true,
      name: true,
      merchantPattern: true,
      amount: true,
      accrualPerCycle: true,
      frequency: true,
      anchorDate: true
    }
  });

  const cycleMatches = await prisma.plaidTransaction.findMany({
    where: {
      tenantId,
      cycleId: cycle.id,
      removed: false,
      supersededById: null,
      txnType: "expense"
    },
    select: { id: true, merchantName: true, name: true }
  });

  const today = startOfUtcDay(now);
  const cycleEnd = startOfUtcDay(cycle.endDate);

  const committed: CommittedItem[] = recurring.map((rec) => {
    const pattern = (rec.merchantPattern ?? "").toUpperCase();
    let matched: { id: string } | null = null;
    if (pattern) {
      matched = cycleMatches.find((tx) => {
        const merchant = `${tx.merchantName ?? ""} ${tx.name ?? ""}`.toUpperCase();
        return merchant.includes(pattern);
      }) ?? null;
    }

    let status: CommittedStatus;
    if (matched) status = "debited";
    else if (rec.anchorDate && rec.anchorDate > today.getUTCDate() && today <= cycleEnd) status = "upcoming";
    else status = "accrued";

    return {
      id: rec.id,
      name: rec.name,
      amount: rec.amount,
      accrualPerCycle: rec.accrualPerCycle,
      frequency: rec.frequency,
      status,
      matchedTransactionId: matched?.id ?? null
    };
  });

  const unsettledAccruals = committed
    .filter((c) => c.status !== "debited")
    .reduce((sum, c) => sum.add(c.accrualPerCycle), new Prisma.Decimal(0));
  const committedTotalAccrued = committed.reduce(
    (sum, c) => sum.add(c.accrualPerCycle),
    new Prisma.Decimal(0)
  );

  const carryover = await getActiveCarryover(tenantId, cycle.startDate);
  const sweepBuffer = settings?.sweepBuffer ?? new Prisma.Decimal(100);

  const safeToSweep = computeSafeToSweep({
    chequingBalance,
    pendingExpenses: pendingSum,
    unsettledAccruals,
    creditCardBalanceThisCycle: creditCardBalanceInCycle,
    sweepBuffer,
    carryover
  });

  const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - today.getTime()) / DAY_MS));

  const incomeReceivedNum = cycle.incomeReceived
    ? Number(cycle.incomeReceived.toString())
    : 0;
  const fixedSavingsPullNum = cycle.fixedSavingsPull
    ? Number(cycle.fixedSavingsPull.toString())
    : 0;
  const committedAccrualsNum = Number(committedTotalAccrued.toString());
  const discretionaryBudget = Math.max(
    0,
    incomeReceivedNum - fixedSavingsPullNum - committedAccrualsNum
  );

  const previousCycleId = await findPreviousCycleId(tenantId, cycle.startDate);
  const breakdown = await getSpendingBreakdown(
    tenantId,
    cycle.id,
    previousCycleId,
    discretionaryBudget
  );

  return {
    cycle: {
      id: cycle.id,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      incomeReceived: cycle.incomeReceived,
      fixedSavingsPull: cycle.fixedSavingsPull,
      sweptAmount: cycle.sweptAmount,
      creditCardPaymentDate: ccDate,
      notes: cycle.notes
    },
    daysRemaining,
    committed,
    committedTotalAccrued,
    spentSoFar: expenseAll,
    pendingSum,
    pendingCount,
    carryover,
    chequingBalance,
    creditCardBalance,
    creditCardBalanceInCycle,
    sweepBuffer,
    safeToSweep,
    settingsConfigured,
    breakdown
  };
}
