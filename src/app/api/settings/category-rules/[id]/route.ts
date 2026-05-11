import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  merchantPattern: z.string().min(1).max(200).optional(),
  categoryId: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(1000).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  const owned = await prisma.categoryRule.findFirst({ where: { id, tenantId: auth.tenant.id } });
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

  if (body.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: body.categoryId, tenantId: auth.tenant.id }
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const rule = await prisma.categoryRule.update({
    where: { id },
    data: {
      ...(body.merchantPattern !== undefined
        ? { merchantPattern: body.merchantPattern.trim().toUpperCase() }
        : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {})
    }
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ rule, reclassified });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;

  await prisma.categoryRule.deleteMany({ where: { id, tenantId: auth.tenant.id } });
  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ ok: true, reclassified });
}
