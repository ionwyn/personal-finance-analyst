import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES } from "@/lib/cycles/types";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  merchantPattern: z.string().nullable().optional(),
  amount: z.number(),
  frequency: z.enum(FREQUENCIES),
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional(),
});

/** Parse a YYYY-MM-DD string as UTC midnight (matches occurrence projection). */
function toUtcDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const accrualPerCycle = computeAccrualPerCycle(body.amount, body.frequency);

  const expense = await prisma.recurringExpense.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      merchantPattern: body.merchantPattern?.trim().toUpperCase() || null,
      amount: body.amount,
      frequency: body.frequency,
      nextDueDate: toUtcDate(body.nextDueDate),
      accrualPerCycle,
      confirmed: body.confirmed ?? true,
      active: body.active ?? true,
    },
  });

  return NextResponse.json({ expense });
}
