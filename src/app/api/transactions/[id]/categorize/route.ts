import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "@/lib/cycles/discovery";

const bodySchema = z.object({
  categoryId: z.string().min(1),
  saveRule: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const [tx, category] = await Promise.all([
    prisma.plaidTransaction.findFirst({
      where: { id, tenantId: auth.tenant.id },
      select: { id: true, merchantName: true, name: true }
    }),
    prisma.category.findFirst({
      where: { id: body.categoryId, tenantId: auth.tenant.id },
      select: { id: true }
    })
  ]);

  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  await prisma.plaidTransaction.update({
    where: { id: tx.id },
    data: {
      categoryId: category.id,
      isManuallyCategorized: true
    }
  });

  if (body.saveRule) {
    const pattern = normalizeMerchant(tx.merchantName ?? tx.name);
    if (pattern) {
      const existing = await prisma.categoryRule.findFirst({
        where: { tenantId: auth.tenant.id, merchantPattern: pattern }
      });
      if (existing) {
        await prisma.categoryRule.update({
          where: { id: existing.id },
          data: { categoryId: category.id }
        });
      } else {
        await prisma.categoryRule.create({
          data: {
            tenantId: auth.tenant.id,
            merchantPattern: pattern,
            categoryId: category.id,
            priority: 0
          }
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
