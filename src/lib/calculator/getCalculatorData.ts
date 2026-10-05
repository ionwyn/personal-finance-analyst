import { startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatCategoryName } from "@/lib/spending/category";

import type { CalculationVariable } from "./types";

export type CalculatorData = {
  variables: CalculationVariable[];
  generatedAt: string;
};

function number(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function monthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "annual":
      return amount / 12;
    default:
      return amount;
  }
}

/**
 * A deliberately small set of explainable, tenant-scoped variable values.
 * Saved formulas reference these stable IDs; labels and balances may change
 * without changing the formula itself.
 */
export async function getCalculatorData(
  tenantId: string,
  now: Date = new Date()
): Promise<CalculatorData> {
  const monthStart = startOfMonth(now);
  const upcomingEnd = new Date(now);
  upcomingEnd.setDate(upcomingEnd.getDate() + 30);

  const [accounts, recurringExpenses, spending] = await Promise.all([
    prisma.plaidAccount.findMany({
      where: { tenantId, tracked: true, type: "depository" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mask: true, currentBalance: true, availableBalance: true },
    }),
    prisma.recurringExpense.findMany({
      where: { tenantId, active: true, confirmed: true },
      orderBy: { name: "asc" },
      select: { name: true, amount: true, frequency: true, nextDueDate: true },
    }),
    prisma.plaidTransaction.groupBy({
      by: ["categoryPrimary"],
      where: {
        tenantId,
        txnType: "expense",
        amount: { gt: 0 },
        date: { gte: monthStart, lte: now },
        removed: false,
        supersededById: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const cashBalance = accounts.reduce(
    (total, account) => total + number(account.currentBalance),
    0
  );
  const availableCash = accounts.reduce(
    (total, account) => total + number(account.availableBalance ?? account.currentBalance),
    0
  );
  const monthlyBills = recurringExpenses.reduce(
    (total, bill) => total + monthlyEquivalent(number(bill.amount), bill.frequency),
    0
  );
  const billsNext30 = recurringExpenses
    .filter(
      (bill) => bill.nextDueDate && bill.nextDueDate >= now && bill.nextDueDate <= upcomingEnd
    )
    .reduce((total, bill) => total + number(bill.amount), 0);

  const variables: CalculationVariable[] = [
    {
      id: "balance:all-current",
      label: "Cash balance",
      value: cashBalance,
      description: "Current balance across tracked chequing and savings accounts",
      group: "balances",
      source: "live",
    },
    {
      id: "balance:all-available",
      label: "Available cash",
      value: availableCash,
      description: "Available balance across tracked chequing and savings accounts",
      group: "balances",
      source: "live",
    },
    ...accounts.map<CalculationVariable>((account) => ({
      id: `account:${account.id}:current`,
      label: account.mask ? `${account.name} ··${account.mask}` : account.name,
      value: number(account.currentBalance),
      description: "Current balance from this tracked account",
      group: "balances",
      source: "live",
    })),
    {
      id: "bills:monthly",
      label: "Known monthly bills",
      value: monthlyBills,
      description: "Monthly equivalent of confirmed recurring expenses",
      group: "bills",
      source: "projected",
    },
    {
      id: "bills:next-30",
      label: "Bills due in 30 days",
      value: billsNext30,
      description: "Confirmed bills with a scheduled due date in the next 30 days",
      group: "bills",
      source: "projected",
    },
  ];

  let monthSpending = 0;
  for (const row of spending) {
    const value = number(row._sum.amount);
    monthSpending += value;
    if (!row.categoryPrimary) continue;
    variables.push({
      id: `spending:month:${row.categoryPrimary}`,
      label: `${formatCategoryName(row.categoryPrimary)} this month`,
      value,
      description: "Posted expense spending since the start of this month",
      group: "spending",
      source: "live",
    });
  }
  variables.push({
    id: "spending:month-total",
    label: "All spending this month",
    value: monthSpending,
    description: "Posted expense spending since the start of this month",
    group: "spending",
    source: "live",
  });

  return { variables, generatedAt: now.toISOString() };
}
