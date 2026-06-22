import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetAmount: z.number().positive().optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  savingsDestinationId: z.string().nullable().optional(),
  manualAmount: z.number().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.savingsGoal.findFirst({ where: { id, tenantId: auth.tenant.id } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  if (body.savingsDestinationId) {
    const dest = await prisma.savingsDestination.findFirst({
      where: { id: body.savingsDestinationId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!dest) return NextResponse.json({ error: "Unknown savings destination" }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.targetAmount !== undefined ? { targetAmount: body.targetAmount } : {}),
      ...(body.startDate !== undefined
        ? { startDate: body.startDate ? new Date(body.startDate) : null }
        : {}),
      ...(body.targetDate !== undefined
        ? { targetDate: body.targetDate ? new Date(body.targetDate) : null }
        : {}),
      ...(body.savingsDestinationId !== undefined
        ? { savingsDestinationId: body.savingsDestinationId }
        : {}),
      ...(body.manualAmount !== undefined ? { manualAmount: body.manualAmount } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  return NextResponse.json({ goal });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.savingsGoal.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  return NextResponse.json({ ok: true });
}
