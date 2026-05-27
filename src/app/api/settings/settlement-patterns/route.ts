import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { reclassifyTenant } from "@/lib/cycles/reclassify";

const bodySchema = z.object({
  label: z.string().min(1).max(200),
  matchPattern: z.string().min(1).max(200),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const pattern = await prisma.settlementPattern.create({
    data: {
      tenantId: auth.tenant.id,
      label: body.label.trim(),
      matchPattern: body.matchPattern.trim().toUpperCase(),
      active: body.active ?? true,
    },
  });

  const reclassified = await reclassifyTenant(auth.tenant.id);
  return NextResponse.json({ pattern, reclassified });
}
