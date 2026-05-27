import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  amount: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.budget.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const budget = await prisma.budget.update({
    where: { id },
    data: {
      ...(body.amount !== undefined ? { amount: body.amount } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  return NextResponse.json({ budget });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.budget.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  return NextResponse.json({ ok: true });
}
