import { endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getTransactionsForTenant } from "@/lib/analytics";
import { numberValue } from "@/lib/analytics/dashboard-helpers";
import { prisma } from "@/lib/prisma";
import { categorizeForSpending } from "@/lib/spending/classify";
import { formatCategoryName } from "@/lib/spending/category";

// ─── Constrained transaction-row lookup ────────────────────────────────────
// For row-level questions the model does NOT get free DB access. It emits a
// structured plan (validated here) describing which transactions it needs; the
// server runs the existing tenant-scoped query, then HARD-CAPS and projects the
// result before it ever reaches the model. This is the single enforcement point
// for "bounded exposure — never dump the table".

export const MAX_ROWS = 50;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

// Named relative windows. A small model converts "the past month" into one of
// these far more reliably than into a pair of ISO dates — so date arithmetic
// happens here, in TypeScript, against a known `now`. Explicit `from`/`to` (an
// actual calendar range the user named) still take precedence over a period.
export const PERIODS = [
  "this_month",
  "last_month",
  "last_30_days",
  "last_90_days",
  "this_year",
  "all_time",
] as const;
export type Period = (typeof PERIODS)[number];

/** Resolve a named period to an inclusive ISO date range against `now`. */
export function resolvePeriod(period: Period, now: Date): { from?: string; to?: string } {
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  switch (period) {
    case "this_month":
      return { from: iso(startOfMonth(now)), to: iso(now) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: iso(startOfMonth(prev)), to: iso(endOfMonth(prev)) };
    }
    case "last_30_days":
      return { from: iso(subDays(now, 30)), to: iso(now) };
    case "last_90_days":
      return { from: iso(subDays(now, 90)), to: iso(now) };
    case "this_year":
      return { from: iso(startOfYear(now)), to: iso(now) };
    case "all_time":
      return {};
  }
}

// Filters the model is allowed to express — a safe subset of
// getTransactionsForTenant. Unknown keys are stripped (not rejected) so a small
// model that nests or invents a stray field still yields a usable filter.
// `q` is a free-text substring match (merchant/name); `category` is a natural
// category name (e.g. "Food and Drink") that we resolve to Plaid's taxonomy
// server-side — see resolveCategory.
export const filtersSchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  period: z.enum(PERIODS).optional(),
  from: isoDate,
  to: isoDate,
  bucket: z.enum(["spending", "income"]).optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
});

export const PLAN_INTENTS = [
  "summary",
  "transaction_list",
  "top_merchants",
  "top_categories",
  "merchant_breakdown",
  "prove_previous_answer",
] as const;
export type PlanIntent = (typeof PLAN_INTENTS)[number];

/** The plan-step output schema the model must produce as JSON. */
const intentPlanSchema = z.object({
  intent: z.enum(PLAN_INTENTS),
  filters: filtersSchema.optional(),
});

const legacyPlanSchema = z
  .object({
    needsTransactions: z.boolean(),
    filters: filtersSchema.optional(),
  })
  .transform(({ needsTransactions, filters }) => ({
    intent: (needsTransactions ? "transaction_list" : "summary") satisfies PlanIntent,
    filters,
  }));

export const planSchema = z.union([intentPlanSchema, legacyPlanSchema]);

/** Drop blank/whitespace-only string filters the model sometimes emits. */
function clean(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

async function resolveFilterArgs(
  tenantSlug: string,
  filters: ScopedFilters,
  now: Date
): Promise<{
  q: string | undefined;
  category: string | undefined;
  resolvedCategory: string | null;
  from: string | undefined;
  to: string | undefined;
}> {
  let categoryArg: string | undefined;
  let qArg = clean(filters.q);
  let resolvedCategory: string | null = null;

  const categoryTerm = clean(filters.category);
  if (categoryTerm) {
    resolvedCategory = await resolveCategory(tenantSlug, categoryTerm);
    if (resolvedCategory) {
      categoryArg = resolvedCategory;
    } else if (!qArg) {
      // No taxonomy match — fall back to a keyword search on the raw term.
      qArg = categoryTerm;
    }
  }

  const periodRange = filters.period ? resolvePeriod(filters.period, now) : {};
  const from = clean(filters.from) ?? periodRange.from;
  const to = clean(filters.to) ?? periodRange.to;

  return { q: qArg, category: categoryArg, resolvedCategory, from, to };
}

export type AssistantPlan = z.infer<typeof planSchema>;
export type ScopedFilters = z.infer<typeof filtersSchema>;

export type ScopedRow = {
  date: string;
  name: string;
  amount: number;
  category: string;
};

export type ScopedResult = {
  rows: ScopedRow[];
  total: number;
  truncated: boolean;
  sumAmount: number;
  resolvedCategory: string | null;
};

type MatchingRow = ScopedRow & {
  rawCategory: string;
  normalizedAmount: number;
};

export type AggregateKind = "merchant" | "category";

export type AggregateRow = {
  label: string;
  amount: number;
  count: number;
  rows: ScopedRow[];
};

export type AggregateResult = {
  kind: AggregateKind;
  rows: AggregateRow[];
  totalGroups: number;
  totalTransactions: number;
  sumAmount: number;
  resolvedCategory: string | null;
  truncated: boolean;
};

const CATEGORY_STOPWORDS = new Set(["and", "the", "of", "or", "a", "to"]);

/** Tokenise a label into a set of meaningful lowercase words. */
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !CATEGORY_STOPWORDS.has(t))
  );
}

/**
 * Map a free-text category term ("Food and Drink", "food drink") to the tenant's
 * actual Plaid `categoryPrimary` (e.g. "FOOD_AND_DRINK") by token overlap. This
 * is what makes category questions reliable despite the model paraphrasing —
 * substring matching on `q` can't bridge "food and drink" vs "FOOD_AND_DRINK".
 */
export async function resolveCategory(tenantSlug: string, term: string): Promise<string | null> {
  const want = tokenize(term);
  if (want.size === 0) return null;

  const cats = await prisma.plaidTransaction.findMany({
    where: { tenant: { slug: tenantSlug }, removed: false, categoryPrimary: { not: null } },
    distinct: ["categoryPrimary"],
    select: { categoryPrimary: true },
  });

  let best: string | null = null;
  let bestScore = 0;
  for (const { categoryPrimary } of cats) {
    if (!categoryPrimary) continue;
    const have = tokenize(categoryPrimary);
    const overlap = [...want].filter((t) => have.has(t)).length;
    if (overlap === 0) continue;
    // Prefer categories that contain ALL requested tokens.
    const score = (overlap === want.size ? 100 : 0) + overlap;
    if (score > bestScore) {
      bestScore = score;
      best = categoryPrimary;
    }
  }
  return best;
}

/**
 * Run the constrained lookup. Returns at most MAX_ROWS rows, projected to a
 * minimal shape, plus a server-computed sum so the model never has to add up
 * dozens of figures itself.
 */
export async function fetchScopedTransactions(
  tenantSlug: string,
  filters: ScopedFilters,
  now: Date = new Date()
): Promise<ScopedResult> {
  const args = await resolveFilterArgs(tenantSlug, filters, now);

  const { rows } = await getTransactionsForTenant({
    tenantSlug,
    q: args.q,
    category: args.category,
    from: args.from,
    to: args.to,
    bucket: filters.bucket,
    amountMin: filters.amountMin == null ? undefined : String(filters.amountMin),
    amountMax: filters.amountMax == null ? undefined : String(filters.amountMax),
  });

  // Sum and count over the full MATCHED set — i.e. rows that passed every filter
  // (getTransactionsForTenant applies amount/bucket filters in memory and caps at
  // 500). We deliberately do NOT use its `total`, which is a DB count taken before
  // the amount/bucket filter and would overstate the match for "over $X" queries.
  const sumAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const total = rows.length;

  const capped = rows.slice(0, MAX_ROWS).map((r) => ({
    date: r.date.slice(0, 10),
    name: r.name,
    amount: r.amount,
    category: formatCategoryName(r.category),
  }));

  return {
    rows: capped,
    total,
    truncated: rows.length > MAX_ROWS,
    sumAmount,
    resolvedCategory: args.resolvedCategory,
  };
}

async function fetchMatchingTransactionsForAggregation(
  tenantSlug: string,
  filters: ScopedFilters,
  now: Date
): Promise<{ rows: MatchingRow[]; resolvedCategory: string | null }> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return { rows: [], resolvedCategory: null };

  const args = await resolveFilterArgs(tenantSlug, filters, now);
  const where: Prisma.PlaidTransactionWhereInput = {
    tenantId: tenant.id,
    removed: false,
    account: { is: { tracked: true } },
  };

  if (args.q) {
    where.OR = [
      { name: { contains: args.q, mode: "insensitive" } },
      { merchantName: { contains: args.q, mode: "insensitive" } },
      { categoryPrimary: { contains: args.q, mode: "insensitive" } },
    ];
  }

  if (args.from || args.to) {
    where.date = {
      gte: args.from ? new Date(`${args.from}T00:00:00.000Z`) : undefined,
      lte: args.to ? new Date(`${args.to}T23:59:59.999Z`) : undefined,
    };
  }

  if (args.category) where.categoryPrimary = args.category;

  const transactions = await prisma.plaidTransaction.findMany({
    where,
    include: { account: true },
    orderBy: { date: "desc" },
  });

  const amountMin = filters.amountMin ?? null;
  const amountMax = filters.amountMax ?? null;

  const rows = transactions
    .map((t) => {
      const amount = numberValue(t.amount);
      const normalizedAmount = Math.round(Math.abs(amount) * 100) / 100;
      const rawCategory = t.categoryPrimary ?? "Uncategorized";
      return {
        date: t.date.toISOString().slice(0, 10),
        name: t.merchantName ?? t.name,
        amount,
        category: formatCategoryName(rawCategory),
        rawCategory,
        normalizedAmount,
        bucket: categorizeForSpending(t),
      };
    })
    .filter((r) => {
      if (filters.bucket && r.bucket !== filters.bucket) return false;
      if (amountMin !== null && r.normalizedAmount < amountMin) return false;
      if (amountMax !== null && r.normalizedAmount > amountMax) return false;
      return true;
    })
    .map((r) => ({
      date: r.date,
      name: r.name,
      amount: r.amount,
      category: r.category,
      rawCategory: r.rawCategory,
      normalizedAmount: r.normalizedAmount,
    }));

  return { rows, resolvedCategory: args.resolvedCategory };
}

/**
 * Compute top merchant/category aggregates on the server. The model receives
 * ranked totals and supporting rows; it should not group or add transactions.
 */
export async function fetchTopAggregates(
  tenantSlug: string,
  filters: ScopedFilters,
  kind: AggregateKind,
  limit = 5,
  now: Date = new Date()
): Promise<AggregateResult> {
  const scopedFilters = { ...filters, bucket: filters.bucket ?? "spending" };
  const { rows, resolvedCategory } = await fetchMatchingTransactionsForAggregation(
    tenantSlug,
    scopedFilters,
    now
  );
  const groups = new Map<string, { amount: number; count: number; rows: ScopedRow[] }>();

  for (const row of rows) {
    const label = kind === "merchant" ? row.name : row.category;
    const current = groups.get(label) ?? { amount: 0, count: 0, rows: [] };
    current.amount += row.normalizedAmount;
    current.count += 1;
    if (current.rows.length < 5) {
      current.rows.push({
        date: row.date,
        name: row.name,
        amount: row.normalizedAmount,
        category: row.category,
      });
    }
    groups.set(label, current);
  }

  const aggregateRows = [...groups.entries()]
    .map(([label, group]) => ({
      label,
      amount: Math.round(group.amount * 100) / 100,
      count: group.count,
      rows: group.rows,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  return {
    kind,
    rows: aggregateRows.slice(0, limit),
    totalGroups: aggregateRows.length,
    totalTransactions: rows.length,
    sumAmount: Math.round(rows.reduce((sum, row) => sum + row.normalizedAmount, 0) * 100) / 100,
    resolvedCategory,
    truncated: aggregateRows.length > limit,
  };
}

export function serializeAggregateRows(result: AggregateResult, currency = "CAD"): string {
  const noun = result.kind === "merchant" ? "MERCHANTS" : "CATEGORIES";
  const label = result.resolvedCategory
    ? `category ${formatCategoryName(result.resolvedCategory)}`
    : "that query";

  if (result.rows.length === 0) {
    return `TOP ${noun}: none found for ${label}.`;
  }

  const lines = [
    `TOP ${noun} for ${label} — server-computed totals ` +
      `(showing ${result.rows.length} of ${result.totalGroups}${result.truncated ? ", truncated" : ""}; ` +
      `${result.totalTransactions} matching transactions; combined total = ${currency} ${result.sumAmount.toLocaleString("en-CA")}):`,
  ];

  for (const row of result.rows) {
    lines.push(
      `- ${row.label}: ${currency} ${row.amount.toLocaleString("en-CA")} across ${row.count} transaction${row.count === 1 ? "" : "s"}`
    );
    for (const source of row.rows) {
      lines.push(
        `  - source row: ${source.date} | ${source.name} | ${currency} ${source.amount.toLocaleString("en-CA")} | ${source.category}`
      );
    }
  }

  return lines.join("\n");
}

/** Serialise scoped rows into a compact block for the narration prompt. */
export function serializeRows(result: ScopedResult, currency = "CAD"): string {
  const label = result.resolvedCategory
    ? `category ${formatCategoryName(result.resolvedCategory)}`
    : "that query";

  if (result.rows.length === 0) {
    return `MATCHING TRANSACTIONS: none found for ${label}.`;
  }

  const header =
    `MATCHING TRANSACTIONS for ${label} — each line is one individual transaction ` +
    `(showing ${result.rows.length} of ${result.total}${result.truncated ? `, capped at ${MAX_ROWS}` : ""}; ` +
    `combined total of all ${result.total} = ${currency} ${result.sumAmount.toLocaleString("en-CA")}):`;

  const lines = [header];
  for (const r of result.rows) {
    lines.push(`- ${r.date} | ${r.name} | ${currency} ${r.amount} | ${r.category}`);
  }
  return lines.join("\n");
}
