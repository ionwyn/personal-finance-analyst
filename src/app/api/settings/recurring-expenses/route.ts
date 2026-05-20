import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES } from "@/lib/cycles/types";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  merchantPattern: z.string().nullable().optional(),
  amount: z.number(),
  frequency: z.enum(FREQUENCIES),
  anchorDate: z.number().int().min(1).max(31).nullable().optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const accrualPerCycle = computeAccrualPerCycle(body.amount, body.frequency);

  const expense = await prisma.recurringExpense.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      merchantPattern: body.merchantPattern?.trim().toUpperCase() || null,
      amount: body.amount,
      frequency: body.frequency,
      anchorDate: body.anchorDate ?? null,
      accrualPerCycle,
      confirmed: body.confirmed ?? true,
      active: body.active ?? true,
    },
  });

  return NextResponse.json({ expense });
}
