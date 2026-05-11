import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().nullable().optional(),
  color: z.string().nullable().optional()
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

  if (body.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: body.parentId, tenantId: auth.tenant.id }
    });
    if (!parent) return NextResponse.json({ error: "Parent category not found" }, { status: 404 });
  }

  const category = await prisma.category.create({
    data: {
      tenantId: auth.tenant.id,
      name: body.name.trim(),
      parentId: body.parentId ?? null,
      color: body.color ?? null
    }
  });

  return NextResponse.json({ category });
}
