import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "@/lib/cycles/utils";
import { getRecurringCandidates } from "@/lib/cycles/recurring-candidates";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES } from "@/lib/cycles/types";

export async function GET() {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const candidates = await getRecurringCandidates(auth.tenant.id);
  return NextResponse.json({ candidates });
}

const confirmSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  frequency: z.enum(FREQUENCIES),
  merchantPattern: z.string().min(1),
  // Plaid linkage (Plan A/C): when the candidate came from a Plaid stream, store
  // the stream id and prefill anchorDate from its predicted next-payment date.
  plaidStreamId: z.string().min(1).optional(),
  anchorDate: z.number().int().min(1).max(31).nullable().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, confirmSchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const pattern = normalizeMerchant(body.merchantPattern) || body.merchantPattern.toUpperCase();
  const accrualPerCycle = computeAccrualPerCycle(body.amount, body.frequency);

  const expense = await prisma.recurringExpense.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      merchantPattern: pattern,
      amount: body.amount,
      frequency: body.frequency,
      anchorDate: body.anchorDate ?? null,
      accrualPerCycle,
      confirmed: true,
      active: true,
      plaidStreamId: body.plaidStreamId ?? null,
    },
  });

  return NextResponse.json({ expense });
}

const dismissSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(200),
  merchantPattern: z.string().min(1),
  amount: z.number().nonnegative(),
  frequency: z.enum(FREQUENCIES),
  // Persist on the tombstone so a dismissed Plaid stream never resurfaces.
  plaidStreamId: z.string().min(1).optional(),
});

export async function DELETE(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, dismissSchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const pattern = normalizeMerchant(body.merchantPattern) || body.merchantPattern.toUpperCase();

  await prisma.recurringExpense.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      merchantPattern: pattern,
      amount: body.amount || 0,
      frequency: body.frequency,
      accrualPerCycle: 0,
      confirmed: false,
      active: false,
      dismissedAt: new Date(),
      plaidStreamId: body.plaidStreamId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
