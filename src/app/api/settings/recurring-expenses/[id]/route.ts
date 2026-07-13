import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES, type Frequency } from "@/lib/cycles/types";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  merchantPattern: z.string().nullable().optional(),
  amount: z.number().optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Parse a YYYY-MM-DD string as UTC midnight (matches occurrence projection). */
function toUtcDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const existing = await prisma.recurringExpense.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

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
      ...(body.nextDueDate !== undefined ? { nextDueDate: toUtcDate(body.nextDueDate) } : {}),
      ...(body.confirmed !== undefined ? { confirmed: body.confirmed } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      accrualPerCycle,
    },
  });

  return NextResponse.json({ expense });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.recurringExpense.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  return NextResponse.json({ ok: true });
}
