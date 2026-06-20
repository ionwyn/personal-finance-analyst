import { NextResponse } from "next/server";
import { z } from "zod";

import { CALENDAR_CATEGORIES } from "@/lib/calendar/types";
import { parseJson, requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setCategory"),
    category: z.enum(CALENDAR_CATEGORIES as [string, ...string[]]),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("setItem"),
    key: z.string().min(1).max(200),
    hidden: z.boolean(),
  }),
]);

export async function PATCH(request: Request) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const parsed = await parseJson(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { data: body } = parsed;

  const tenantId = auth.tenant.id;
  const current = await prisma.calendarPreference.findUnique({ where: { tenantId } });
  const disabled = new Set(current?.disabledCategories ?? []);
  const hidden = new Set(current?.hiddenKeys ?? []);

  if (body.action === "setCategory") {
    if (body.enabled) disabled.delete(body.category);
    else disabled.add(body.category);
  } else {
    if (body.hidden) hidden.add(body.key);
    else hidden.delete(body.key);
  }

  const preference = await prisma.calendarPreference.upsert({
    where: { tenantId },
    create: {
      tenantId,
      disabledCategories: [...disabled],
      hiddenKeys: [...hidden],
    },
    update: {
      disabledCategories: [...disabled],
      hiddenKeys: [...hidden],
    },
  });

  return NextResponse.json({ preference });
}
