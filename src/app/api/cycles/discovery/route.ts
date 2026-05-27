import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { discoverRecurringCandidates, normalizeMerchant } from "@/lib/cycles/discovery";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES } from "@/lib/cycles/types";

export async function GET() {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const candidates = await discoverRecurringCandidates(auth.tenant.id);
  return NextResponse.json({ candidates });
}

const confirmSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  frequency: z.enum(FREQUENCIES),
  merchantPattern: z.string().min(1),
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
      anchorDate: null,
      accrualPerCycle,
      confirmed: true,
      active: true,
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
    },
  });

  return NextResponse.json({ ok: true });
}
