import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: z.number().positive(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  savingsDestinationId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  // If a destination is supplied, it must belong to this tenant.
  if (body.savingsDestinationId) {
    const dest = await prisma.savingsDestination.findFirst({
      where: { id: body.savingsDestinationId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!dest) return NextResponse.json({ error: "Unknown savings destination" }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      targetAmount: body.targetAmount,
      startDate: body.startDate ? new Date(body.startDate) : null,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      savingsDestinationId: body.savingsDestinationId ?? null,
    },
  });

  return NextResponse.json({ goal });
}
