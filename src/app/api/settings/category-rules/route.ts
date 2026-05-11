import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  merchantPattern: z.string().min(1).max(200),
  categoryId: z.string().min(1),
  priority: z.number().int().min(0).max(1000).optional()
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

  const category = await prisma.category.findFirst({
    where: { id: body.categoryId, tenantId: auth.tenant.id }
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const rule = await prisma.categoryRule.create({
    data: {
      tenantId: auth.tenant.id,
      merchantPattern: body.merchantPattern.trim().toUpperCase(),
      categoryId: body.categoryId,
      priority: body.priority ?? 0
    }
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ rule, reclassified });
}
