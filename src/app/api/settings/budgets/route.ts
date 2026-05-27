import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  categoryPrimary: z.string().min(1).max(100),
  amount: z.number().positive(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const categoryPrimary = body.categoryPrimary.trim().toUpperCase();

  // One budget per category per tenant — upsert so re-adding edits the cap.
  const budget = await prisma.budget.upsert({
    where: { tenantId_categoryPrimary: { tenantId: auth.tenant.id, categoryPrimary } },
    update: { amount: body.amount, active: body.active ?? true },
    create: {
      tenantId: auth.tenant.id,
      categoryPrimary,
      amount: body.amount,
      active: body.active ?? true,
    },
  });

  return NextResponse.json({ budget });
}
