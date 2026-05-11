import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES, type Frequency } from "@/lib/cycles/types";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  merchantPattern: z.string().nullable().optional(),
  amount: z.number().optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  anchorDate: z.number().int().min(1).max(31).nullable().optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const existing = await prisma.recurringExpense.findFirst({
    where: { id, tenantId: auth.tenant.id }
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const nextAmount = body.amount ?? Number(existing.amount.toString());
  const nextFrequency = (body.frequency ?? existing.frequency) as Frequency;
  const accrualPerCycle = computeAccrualPerCycle(nextAmount, nextFrequency);

  const expense = await prisma.recurringExpense.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.merchantPattern !== undefined
        ? { merchantPattern: body.merchantPattern?.trim().toUpperCase() || null }
        : {}),
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
      ...(body.anchorDate !== undefined ? { anchorDate: body.anchorDate } : {}),
      ...(body.confirmed !== undefined ? { confirmed: body.confirmed } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      accrualPerCycle
    }
  });

  return NextResponse.json({ expense });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.recurringExpense.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  return NextResponse.json({ ok: true });
}
