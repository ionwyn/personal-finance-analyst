import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  matchPattern: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.incomeSource.findFirst({
    where: { id, tenantId: auth.tenant.id },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const incomeSource = await prisma.incomeSource.update({
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
  return NextResponse.json({ incomeSource, reclassified });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.incomeSource.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ ok: true, reclassified });
}
