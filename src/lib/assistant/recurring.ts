import type { Prisma } from "@prisma/client";

import type { ScopedFilters } from "@/lib/assistant/query";
import { prisma } from "@/lib/prisma";

type Frequency = string | null;

export type RecurringExpenseRow = {
  name: string;
  amount: number;
  frequency: string;
  anchorDate: number | null;
  accrualPerCycle: number;
  monthlyEquivalent: number;
  hasMerchantPattern: boolean;
};

export type RecurringStreamRow = {
  name: string;
  amount: number;
  lastAmount: number;
  frequencyRaw: string;
  frequency: string | null;
  monthlyEquivalent: number;
  lastDate: string | null;
  predictedNextDate: string | null;
  status: string;
  isUserModified: boolean;
};

export type RecurringSpendStatusResult = {
  scope: string | null;
  confirmed: {
    count: number;
    totalMonthlyEquivalent: number;
    totalAccrualPerCycle: number;
    rows: RecurringExpenseRow[];
  };
  detectedOutflows: {
    count: number;
    totalMonthlyEquivalent: number;
    rows: RecurringStreamRow[];
  };
  detectedInflows: {
    count: number;
    rows: RecurringStreamRow[];
  };
};

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  const raw = typeof value === "number" ? value : value.toNumber();
  return Math.round(raw * 100) / 100;
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-CA")}`;
}

function monthlyFactor(frequency: Frequency): number {
  switch (frequency?.toLowerCase()) {
    case "weekly":
      return 52 / 12;
    case "biweekly":
      return 26 / 12;
    case "annual":
    case "annually":
      return 1 / 12;
    case "monthly":
    default:
      return 1;
  }
}

function monthlyEquivalent(amount: number, frequency: Frequency): number {
  return Math.round(amount * monthlyFactor(frequency) * 100) / 100;
}

function normalizeScope(filters: ScopedFilters): string | null {
  const raw = filters.q?.trim() || filters.category?.trim() || "";
  return raw || null;
}

function matchesScope(value: string, scope: string | null) {
  return !scope || value.toLowerCase().includes(scope.toLowerCase());
}

export async function fetchRecurringSpendStatus(
  tenantId: string,
  filters: ScopedFilters = {}
): Promise<RecurringSpendStatusResult> {
  const scope = normalizeScope(filters);
  const [expenses, streams] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { tenantId, active: true, confirmed: true },
      orderBy: [{ name: "asc" }],
      select: {
        name: true,
        merchantPattern: true,
        amount: true,
        frequency: true,
        anchorDate: true,
        accrualPerCycle: true,
      },
    }),
    prisma.plaidRecurringStream.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ predictedNextDate: "asc" }, { merchantName: "asc" }],
      select: {
        direction: true,
        merchantName: true,
        description: true,
        frequencyRaw: true,
        frequency: true,
        averageAmount: true,
        lastAmount: true,
        lastDate: true,
        predictedNextDate: true,
        status: true,
        isUserModified: true,
      },
    }),
  ]);

  const confirmedRows = expenses
    .filter((row) => matchesScope(`${row.name} ${row.merchantPattern ?? ""}`, scope))
    .map((row) => {
      const amount = num(row.amount);
      return {
        name: row.name,
        amount,
        frequency: row.frequency,
        anchorDate: row.anchorDate,
        accrualPerCycle: num(row.accrualPerCycle),
        monthlyEquivalent: monthlyEquivalent(amount, row.frequency),
        hasMerchantPattern: Boolean(row.merchantPattern),
      };
    })
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.name.localeCompare(b.name));

  const streamRows = streams
    .map((row) => {
      const name = row.merchantName ?? row.description ?? "Unknown recurring stream";
      const amount = num(row.averageAmount);
      return {
        direction: row.direction,
        row: {
          name,
          amount,
          lastAmount: num(row.lastAmount),
          frequencyRaw: row.frequencyRaw,
          frequency: row.frequency,
          monthlyEquivalent: monthlyEquivalent(amount, row.frequency),
          lastDate: iso(row.lastDate),
          predictedNextDate: iso(row.predictedNextDate),
          status: row.status,
          isUserModified: row.isUserModified,
        },
      };
    })
    .filter((item) => matchesScope(item.row.name, scope));

  const detectedOutflows = streamRows
    .filter((item) => item.direction === "outflow")
    .map((item) => item.row)
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.name.localeCompare(b.name));
  const detectedInflows = streamRows
    .filter((item) => item.direction === "inflow")
    .map((item) => item.row)
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.name.localeCompare(b.name));

  return {
    scope,
    confirmed: {
      count: confirmedRows.length,
      totalMonthlyEquivalent: num(
        confirmedRows.reduce((sum, row) => sum + row.monthlyEquivalent, 0)
      ),
      totalAccrualPerCycle: num(confirmedRows.reduce((sum, row) => sum + row.accrualPerCycle, 0)),
      rows: confirmedRows.slice(0, 20),
    },
    detectedOutflows: {
      count: detectedOutflows.length,
      totalMonthlyEquivalent: num(
        detectedOutflows.reduce((sum, row) => sum + row.monthlyEquivalent, 0)
      ),
      rows: detectedOutflows.slice(0, 20),
    },
    detectedInflows: {
      count: detectedInflows.length,
      rows: detectedInflows.slice(0, 10),
    },
  };
}

export function serializeRecurringSpendStatus(
  result: RecurringSpendStatusResult,
  currency = "CAD"
): string {
  const scope = result.scope ? ` matching "${result.scope}"` : "";
  const lines = [
    `RECURRING SPEND STATUS${scope} - server-computed confirmed recurring expenses plus cached Plaid recurring streams:`,
    `- Confirmed recurring expenses: ${result.confirmed.count}; monthly equivalent ${money(result.confirmed.totalMonthlyEquivalent, currency)}; pay-cycle accrual ${money(result.confirmed.totalAccrualPerCycle, currency)}`,
    `- Detected active recurring outflows: ${result.detectedOutflows.count}; monthly equivalent ${money(result.detectedOutflows.totalMonthlyEquivalent, currency)}`,
    `- Detected active recurring inflows: ${result.detectedInflows.count}`,
  ];

  if (result.confirmed.rows.length > 0) {
    lines.push("", "CONFIRMED RECURRING EXPENSES:");
    for (const row of result.confirmed.rows) {
      lines.push(
        `- ${row.name}: ${money(row.amount, currency)} ${row.frequency}; monthly equivalent ${money(row.monthlyEquivalent, currency)}; pay-cycle accrual ${money(row.accrualPerCycle, currency)}; anchor day ${row.anchorDate ?? "not set"}; merchant pattern ${row.hasMerchantPattern ? "yes" : "no"}`
      );
    }
  }

  if (result.detectedOutflows.rows.length > 0) {
    lines.push("", "DETECTED ACTIVE RECURRING OUTFLOWS:");
    for (const row of result.detectedOutflows.rows) {
      lines.push(
        `- ${row.name}: average ${money(row.amount, currency)}; last ${money(row.lastAmount, currency)}; ${row.frequency ?? row.frequencyRaw}; monthly equivalent ${money(row.monthlyEquivalent, currency)}; last date ${row.lastDate ?? "n/a"}; predicted next date ${row.predictedNextDate ?? "n/a"}; status ${row.status}; user modified ${row.isUserModified ? "yes" : "no"}`
      );
    }
  }

  if (result.detectedInflows.rows.length > 0) {
    lines.push("", "DETECTED ACTIVE RECURRING INFLOWS:");
    for (const row of result.detectedInflows.rows) {
      lines.push(
        `- ${row.name}: average ${money(row.amount, currency)}; ${row.frequency ?? row.frequencyRaw}; predicted next date ${row.predictedNextDate ?? "n/a"}; status ${row.status}`
      );
    }
  }

  return lines.join("\n");
}
