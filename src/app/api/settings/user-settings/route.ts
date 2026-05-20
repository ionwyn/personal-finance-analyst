import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { generatePayCycles } from "@/lib/cycles/generate";
import { reclassifyTenant } from "@/lib/cycles/reclassify";
import { seedCycleDefaultsForTenant } from "@/lib/cycles/seed";

const bodySchema = z.object({
  lastPaycheckDate: z.string().nullable().optional(),
  employerMerchantPattern: z.string().nullable().optional(),
  defaultFixedSavings: z.number().nullable().optional(),
  sweepBuffer: z.number().nullable().optional(),
  ccPaymentDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
});

function parseDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}

export async function PATCH(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  await seedCycleDefaultsForTenant(auth.tenant.id);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid body" },
      { status: 400 }
    );
  }

  const lastPaycheckDate = parseDateOnly(body.lastPaycheckDate);
  const existing = await prisma.userSettings.findUnique({
    where: { tenantId: auth.tenant.id },
    select: { lastPaycheckDate: true, employerMerchantPattern: true },
  });

  const updateData: Record<string, unknown> = {};
  if (lastPaycheckDate !== undefined) updateData.lastPaycheckDate = lastPaycheckDate;
  if (body.employerMerchantPattern !== undefined)
    updateData.employerMerchantPattern = body.employerMerchantPattern?.trim() || null;
  if (body.defaultFixedSavings !== undefined)
    updateData.defaultFixedSavings = body.defaultFixedSavings;
  if (body.sweepBuffer !== undefined) updateData.sweepBuffer = body.sweepBuffer ?? 100;
  if (body.ccPaymentDayOfMonth !== undefined)
    updateData.ccPaymentDayOfMonth = body.ccPaymentDayOfMonth;

  const settings = await prisma.userSettings.update({
    where: { tenantId: auth.tenant.id },
    data: updateData,
  });

  const paycheckChanged =
    lastPaycheckDate !== undefined &&
    lastPaycheckDate !== null &&
    (!existing?.lastPaycheckDate ||
      existing.lastPaycheckDate.getTime() !== lastPaycheckDate.getTime());
  if (paycheckChanged && lastPaycheckDate) {
    await generatePayCycles(auth.tenant.id, lastPaycheckDate);
  }

  const employerChanged =
    body.employerMerchantPattern !== undefined &&
    (body.employerMerchantPattern?.trim() || null) !== (existing?.employerMerchantPattern ?? null);
  let reclassified = 0;
  if (employerChanged || paycheckChanged) {
    reclassified = await reclassifyTenant(auth.tenant.id);
  }

  return NextResponse.json({ settings, reclassified });
}
