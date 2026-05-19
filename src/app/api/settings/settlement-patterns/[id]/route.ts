import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  matchPattern: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.settlementPattern.findFirst({
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

  const pattern = await prisma.settlementPattern.update({
    where: { id },
    data: {
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.matchPattern !== undefined
        ? { matchPattern: body.matchPattern.trim().toUpperCase() }
        : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ pattern, reclassified });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.settlementPattern.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ ok: true, reclassified });
}
