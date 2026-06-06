import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { ensureCycleForDate } from "@/lib/cycles/generate";
import { dayOfMonthInCycle, startOfUtcDay } from "@/lib/cycles/getCurrentCycle";
import { SPENDING_FILTER } from "@/lib/spending/classify";

const DAY_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_WINDOW_DAYS = 7;
const CANDIDATE_LIMIT = 10;

const settleSchema = z.object({
  recurringExpenseId: z.string().min(1),
  transactionId: z.string().min(1).optional(),
  method: z.string().max(60).optional(),
});

const unsettleSchema = z.object({
  recurringExpenseId: z.string().min(1),
});

/**
 * GET /api/cycles/settlements?recurringExpenseId=...
 * Returns candidate transactions to link as the settlement for the given
 * recurring expense in the current cycle — debits within ±7 days of the
 * expense's anchor date, ranked by how close their amount is to the expected
 * amount, then by date proximity.
 */
export async function GET(request: Request) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const recurringExpenseId = new URL(request.url).searchParams.get("recurringExpenseId");
  if (!recurringExpenseId) {
    return NextResponse.json({ error: "recurringExpenseId is required" }, { status: 400 });
  }

  const expense = await prisma.recurringExpense.findFirst({
    where: { id: recurringExpenseId, tenantId: auth.tenant.id },
    select: { id: true, amount: true, anchorDate: true },
  });
  if (!expense) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  const cycle = await ensureCycleForDate(auth.tenant.id, new Date());
  const anchor = dayOfMonthInCycle(cycle.startDate, cycle.endDate, expense.anchorDate);

  // Window centres on the anchor date when set, otherwise spans the whole cycle.
  const gte = anchor
    ? new Date(anchor.getTime() - CANDIDATE_WINDOW_DAYS * DAY_MS)
    : startOfUtcDay(cycle.startDate);
  const lte = anchor
    ? new Date(anchor.getTime() + CANDIDATE_WINDOW_DAYS * DAY_MS)
    : startOfUtcDay(cycle.endDate);

  const rows = await prisma.plaidTransaction.findMany({
    where: { ...SPENDING_FILTER, tenantId: auth.tenant.id, date: { gte, lte } },
    select: { id: true, name: true, merchantName: true, amount: true, date: true, pending: true },
    orderBy: { date: "desc" },
    take: 100,
  });

  const expected = Number(expense.amount.toString());
  const anchorMs = anchor?.getTime() ?? null;
  const ranked = rows
    .map((tx) => ({
      tx,
      amountDelta: Math.abs(Number(tx.amount.toString()) - expected),
      dateDelta: anchorMs === null ? 0 : Math.abs(tx.date.getTime() - anchorMs),
    }))
    .sort((a, b) => a.amountDelta - b.amountDelta || a.dateDelta - b.dateDelta)
    .slice(0, CANDIDATE_LIMIT);

  const candidates = ranked.map(({ tx }) => ({
    id: tx.id,
    name: tx.merchantName ?? tx.name,
    amount: tx.amount,
    date: tx.date,
    pending: tx.pending,
  }));

  return NextResponse.json({ candidates });
}

/**
 * POST /api/cycles/settlements
 * Settle a recurring expense for the current cycle — either by linking a
 * transaction (transactionId) or asserting manual payment (method, no txn).
 * Idempotent: upserts on (recurringExpenseId, cycleId).
 */
export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, settleSchema);
  if ("error" in parsed) return parsed.error;
  const { recurringExpenseId, transactionId, method } = parsed.data;

  const expense = await prisma.recurringExpense.findFirst({
    where: { id: recurringExpenseId, tenantId: auth.tenant.id },
    select: { id: true },
  });
  if (!expense) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  if (transactionId) {
    const tx = await prisma.plaidTransaction.findFirst({
      where: { id: transactionId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
  }

  const cycle = await ensureCycleForDate(auth.tenant.id, new Date());

  const settlement = await prisma.committedSettlement.upsert({
    where: { recurringExpenseId_cycleId: { recurringExpenseId, cycleId: cycle.id } },
    create: {
      tenantId: auth.tenant.id,
      recurringExpenseId,
      cycleId: cycle.id,
      transactionId: transactionId ?? null,
      method: method ?? null,
    },
    update: {
      transactionId: transactionId ?? null,
      method: method ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: settlement.id });
}

/**
 * DELETE /api/cycles/settlements
 * Undo a settlement for the current cycle (item returns to accruing).
 */
export async function DELETE(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, unsettleSchema);
  if ("error" in parsed) return parsed.error;

  const cycle = await ensureCycleForDate(auth.tenant.id, new Date());

  await prisma.committedSettlement.deleteMany({
    where: {
      tenantId: auth.tenant.id,
      cycleId: cycle.id,
      recurringExpenseId: parsed.data.recurringExpenseId,
    },
  });

  return NextResponse.json({ ok: true });
}
