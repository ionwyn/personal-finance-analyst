import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { computeAccrualPerCycle } from "@/lib/cycles/accrual";
import { FREQUENCIES } from "@/lib/cycles/types";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  merchantPattern: z.string().nullable().optional(),
  amount: z.number(),
  frequency: z.enum(FREQUENCIES),
  anchorDate: z.number().int().min(1).max(31).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional()
});

export async function POST(request: Request) {
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

  if (body.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: body.categoryId, tenantId: auth.tenant.id }
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
      categoryId: body.categoryId ?? null,
      confirmed: body.confirmed ?? true,
      active: body.active ?? true
    }
  });

  return NextResponse.json({ expense });
}
