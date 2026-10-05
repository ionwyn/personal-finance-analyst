import type { Prisma } from "@prisma/client";

import { resolvePeriod, type ScopedFilters } from "@/lib/assistant/query";
import { prisma } from "@/lib/prisma";
import { categorizeForSpending } from "@/lib/spending/classify";
import { loadInvestments } from "@/lib/investments/loader";

export type AssistantPlaidAccountRow = {
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currency: string;
  tracked: boolean;
  currentBalance: number;
  availableBalance: number;
  periodSpend: number;
  periodIncome: number;
  periodTransactionCount: number;
};

export type AssistantInvestmentAccountRow = {
  name: string;
  institution: string;
  registration: string;
  kind: string;
  currency: string;
  tracked: boolean;
  totalValue: number;
  cash: number;
  liability: number;
  positionCount: number;
  lastSyncAt: string | null;
};

export type AccountStatusResult = {
  scope: string | null;
  period: { from: string | null; to: string | null; label: string };
  plaid: {
    count: number;
    trackedCount: number;
    totalCurrentBalance: number;
    totalAvailableBalance: number;
    totalSpend: number;
    totalIncome: number;
    rows: AssistantPlaidAccountRow[];
  };
  investments: {
    count: number;
    trackedCount: number;
    totalValue: number;
    totalCash: number;
    totalLiability: number;
    rows: AssistantInvestmentAccountRow[];
  };
};

type TxnForAccount = {
  accountId: string;
  amount: Prisma.Decimal;
  txnType: string;
  categoryPrimary: string | null;
  categoryDetailed: string | null;
  removed: boolean;
  supersededById: string | null;
};

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  const raw = typeof value === "number" ? value : value.toNumber();
  return Math.round(raw * 100) / 100;
}

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-CA")}`;
}

function normalizeScope(filters: ScopedFilters): string | null {
  const raw = filters.q?.trim() || filters.category?.trim() || "";
  return raw || null;
}

function matchesScope(parts: (string | null | undefined)[], scope: string | null) {
  if (!scope) return true;
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(scope.toLowerCase());
}

function resolveAccountPeriod(filters: ScopedFilters, now: Date) {
  const explicit = filters.from || filters.to;
  const resolved = explicit
    ? { from: filters.from, to: filters.to }
    : resolvePeriod(filters.period ?? "this_month", now);
  const label = explicit
    ? "explicit date range"
    : filters.period
      ? filters.period.replaceAll("_", " ")
      : "this month";
  return {
    from: resolved.from ?? null,
    to: resolved.to ?? null,
    label,
  };
}

export async function fetchAccountStatus(input: {
  tenantId: string;
  filters?: ScopedFilters;
  now?: Date;
}): Promise<AccountStatusResult> {
  const filters = input.filters ?? {};
  const now = input.now ?? new Date();
  const scope = normalizeScope(filters);
  const period = resolveAccountPeriod(filters, now);

  const [plaidAccounts, investments] = await Promise.all([
    prisma.plaidAccount.findMany({
      where: { tenantId: input.tenantId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        officialName: true,
        type: true,
        subtype: true,
        isoCurrencyCode: true,
        unofficialCurrencyCode: true,
        availableBalance: true,
        currentBalance: true,
        tracked: true,
      },
    }),
    loadInvestments(input.tenantId),
  ]);

  const filteredPlaid = plaidAccounts.filter((account) =>
    matchesScope([account.name, account.officialName, account.type, account.subtype], scope)
  );
  const plaidIds = filteredPlaid.map((account) => account.id);
  const txns: TxnForAccount[] =
    plaidIds.length > 0
      ? await prisma.plaidTransaction.findMany({
          where: {
            tenantId: input.tenantId,
            accountId: { in: plaidIds },
            removed: false,
            supersededById: null,
            ...(period.from || period.to
              ? {
                  date: {
                    gte: period.from ? new Date(`${period.from}T00:00:00.000Z`) : undefined,
                    lte: period.to ? new Date(`${period.to}T23:59:59.999Z`) : undefined,
                  },
                }
              : {}),
          },
          select: {
            accountId: true,
            amount: true,
            txnType: true,
            categoryPrimary: true,
            categoryDetailed: true,
            removed: true,
            supersededById: true,
          },
        })
      : [];

  const spendByAccount = new Map<string, { spend: number; income: number; count: number }>();
  for (const txn of txns) {
    const bucket = categorizeForSpending(txn);
    const slot = spendByAccount.get(txn.accountId) ?? { spend: 0, income: 0, count: 0 };
    if (bucket === "spending") {
      slot.spend += num(txn.amount);
      slot.count += 1;
    } else if (bucket === "income") {
      slot.income += Math.abs(num(txn.amount));
      slot.count += 1;
    }
    spendByAccount.set(txn.accountId, slot);
  }

  const plaidRows = filteredPlaid.map((account) => {
    const slot = spendByAccount.get(account.id) ?? { spend: 0, income: 0, count: 0 };
    return {
      name: account.name,
      officialName: account.officialName,
      type: account.type,
      subtype: account.subtype,
      currency: account.isoCurrencyCode ?? account.unofficialCurrencyCode ?? "CAD",
      tracked: account.tracked,
      currentBalance: num(account.currentBalance),
      availableBalance: num(account.availableBalance),
      periodSpend: num(slot.spend),
      periodIncome: num(slot.income),
      periodTransactionCount: slot.count,
    };
  });

  const investmentRows = investments.accounts
    .filter((account) =>
      matchesScope([account.name, account.registration, account.institution, account.kind], scope)
    )
    .map((account) => ({
      name: account.name,
      institution: account.institution,
      registration: account.registration,
      kind: account.kind,
      currency: account.currency,
      tracked: account.tracked,
      totalValue: num(account.totalValue),
      cash: num(account.cash),
      liability: num(account.liabilityCAD),
      positionCount: account.positionCount,
      lastSyncAt: account.lastSyncAt,
    }));

  return {
    scope,
    period,
    plaid: {
      count: plaidRows.length,
      trackedCount: plaidRows.filter((row) => row.tracked).length,
      totalCurrentBalance: num(plaidRows.reduce((sum, row) => sum + row.currentBalance, 0)),
      totalAvailableBalance: num(plaidRows.reduce((sum, row) => sum + row.availableBalance, 0)),
      totalSpend: num(plaidRows.reduce((sum, row) => sum + row.periodSpend, 0)),
      totalIncome: num(plaidRows.reduce((sum, row) => sum + row.periodIncome, 0)),
      rows: plaidRows,
    },
    investments: {
      count: investmentRows.length,
      trackedCount: investmentRows.filter((row) => row.tracked).length,
      totalValue: num(investmentRows.reduce((sum, row) => sum + row.totalValue, 0)),
      totalCash: num(investmentRows.reduce((sum, row) => sum + row.cash, 0)),
      totalLiability: num(investmentRows.reduce((sum, row) => sum + row.liability, 0)),
      rows: investmentRows,
    },
  };
}

export function serializeAccountStatus(result: AccountStatusResult, currency = "CAD"): string {
  const scope = result.scope ? ` matching "${result.scope}"` : "";
  const lines = [
    `ACCOUNT STATUS${scope} - server-computed account balances and Plaid spending/income for ${result.period.label}:`,
    `- Period: ${result.period.from ?? "unbounded"} to ${result.period.to ?? "unbounded"}`,
    `- Plaid accounts shown: ${result.plaid.count}; tracked ${result.plaid.trackedCount}; current balance ${money(result.plaid.totalCurrentBalance, currency)}; available ${money(result.plaid.totalAvailableBalance, currency)}; period spend ${money(result.plaid.totalSpend, currency)}; period income ${money(result.plaid.totalIncome, currency)}`,
    `- Investment accounts shown: ${result.investments.count}; tracked ${result.investments.trackedCount}; total value ${money(result.investments.totalValue, currency)}; cash ${money(result.investments.totalCash, currency)}; liability ${money(result.investments.totalLiability, currency)}`,
  ];

  if (result.plaid.rows.length > 0) {
    lines.push("", "PLAID ACCOUNTS:");
    for (const row of result.plaid.rows) {
      lines.push(
        `- ${row.name}${row.officialName ? ` (${row.officialName})` : ""}: ${row.type}${row.subtype ? `/${row.subtype}` : ""}; tracked ${row.tracked ? "yes" : "no"}; balance ${money(row.currentBalance, row.currency)}; available ${money(row.availableBalance, row.currency)}; period spend ${money(row.periodSpend, currency)}; period income ${money(row.periodIncome, currency)}; transactions counted ${row.periodTransactionCount}`
      );
    }
  }

  if (result.investments.rows.length > 0) {
    lines.push("", "INVESTMENT ACCOUNTS:");
    for (const row of result.investments.rows) {
      lines.push(
        `- ${row.name}: ${row.institution}; ${row.registration}; kind ${row.kind}; tracked ${row.tracked ? "yes" : "no"}; total value ${money(row.totalValue, currency)}; cash ${money(row.cash, currency)}; liability ${money(row.liability, currency)}; positions ${row.positionCount}; last sync ${row.lastSyncAt ?? "n/a"}`
      );
    }
  }

  return lines.join("\n");
}
