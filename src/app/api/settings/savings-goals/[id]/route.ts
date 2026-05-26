import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().nullable().optional(),
  savingsDestinationId: z.string().nullable().optional(),
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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

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
      ...(body.targetDate !== undefined
        ? { targetDate: body.targetDate ? new Date(body.targetDate) : null }
        : {}),
      ...(body.savingsDestinationId !== undefined
        ? { savingsDestinationId: body.savingsDestinationId }
        : {}),
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
