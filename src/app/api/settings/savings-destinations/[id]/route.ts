import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  accountName: z.string().min(1).max(200).optional(),
  matchPattern: z.string().min(1).max(200).optional(),
  label: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.savingsDestination.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
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

  const destination = await prisma.savingsDestination.update({
    where: { id },
    data: {
      ...(body.accountName !== undefined ? { accountName: body.accountName.trim() } : {}),
      ...(body.matchPattern !== undefined
        ? { matchPattern: body.matchPattern.trim().toUpperCase() }
        : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ destination, reclassified });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.savingsDestination.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ ok: true, reclassified });
}
