import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { generatePayCycles } from "@/lib/cycles/generate";
import { reclassifyTenant } from "@/lib/cycles/reclassify";
import { seedCycleDefaultsForTenant } from "@/lib/cycles/seed";
import { LANDING_VALUES } from "@/lib/settings/landing";

const bodySchema = z.object({
  lastPaycheckDate: z.string().nullable().optional(),
  employerMerchantPattern: z.string().nullable().optional(),
  defaultFixedSavings: z.number().nullable().optional(),
  sweepBuffer: z.number().nullable().optional(),
  ccPaymentDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  // Only fixed-length strides are supported by the cycle engine (weekly/biweekly).
  // Semi-monthly / monthly need an engine overhaul — see SETTINGS_IMPLEMENTATION.md.
  payFrequencyDays: z
    .number()
    .int()
    .refine((v) => v === 7 || v === 14, "Only weekly (7) or biweekly (14) are supported")
    .optional(),
  defaultLanding: z.enum(LANDING_VALUES).optional(),
  displayCurrency: z.enum(["CAD", "USD"]).optional(),
  budgetWarnPct: z.number().int().min(0).max(200).optional(),
  budgetAlarmPct: z.number().int().min(0).max(200).optional(),
  budgetRollForward: z.boolean().optional(),
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
    select: { lastPaycheckDate: true, employerMerchantPattern: true, payFrequencyDays: true },
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
  if (body.payFrequencyDays !== undefined) updateData.payFrequencyDays = body.payFrequencyDays;
  if (body.defaultLanding !== undefined) updateData.defaultLanding = body.defaultLanding;
  if (body.displayCurrency !== undefined) updateData.displayCurrency = body.displayCurrency;
  if (body.budgetWarnPct !== undefined) updateData.budgetWarnPct = body.budgetWarnPct;
  if (body.budgetAlarmPct !== undefined) updateData.budgetAlarmPct = body.budgetAlarmPct;
  if (body.budgetRollForward !== undefined) updateData.budgetRollForward = body.budgetRollForward;

  const settings = await prisma.userSettings.update({
    where: { tenantId: auth.tenant.id },
    data: updateData,
  });

  const paycheckChanged =
    lastPaycheckDate !== undefined &&
    lastPaycheckDate !== null &&
    (!existing?.lastPaycheckDate ||
      existing.lastPaycheckDate.getTime() !== lastPaycheckDate.getTime());

  const frequencyChanged =
    body.payFrequencyDays !== undefined && body.payFrequencyDays !== existing?.payFrequencyDays;

  // Regenerate forward cycles at the new stride. NOTE: this upserts new cycle
  // boundaries but does not delete/rebuild closed historical cycles or re-bucket
  // already-bound transactions — that retro migration is a Phase 2 overhaul item
  // (see SETTINGS_IMPLEMENTATION.md).
  const anchor = lastPaycheckDate ?? settings.lastPaycheckDate ?? null;
  if ((paycheckChanged || frequencyChanged) && anchor) {
    await generatePayCycles(auth.tenant.id, anchor, { lengthDays: settings.payFrequencyDays });
  }

  const employerChanged =
    body.employerMerchantPattern !== undefined &&
    (body.employerMerchantPattern?.trim() || null) !== (existing?.employerMerchantPattern ?? null);
  let reclassified = 0;
  if (employerChanged || paycheckChanged || frequencyChanged) {
    reclassified = await reclassifyTenant(auth.tenant.id);
  }

  return NextResponse.json({ settings, reclassified });
}
