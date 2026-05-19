import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  accountName: z.string().min(1).max(200),
  matchPattern: z.string().min(1).max(200),
  label: z.string().nullable().optional(),
  active: z.boolean().optional(),
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

  const destination = await prisma.savingsDestination.create({
    data: {
      tenantId: auth.tenant.id,
      accountName: body.accountName.trim(),
      matchPattern: body.matchPattern.trim().toUpperCase(),
      label: body.label ?? null,
      active: body.active ?? true,
    },
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ destination, reclassified });
}
