import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
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
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof confirmSchema>;
  try {
    body = confirmSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

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
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof dismissSchema>;
  try {
    body = dismissSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

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
