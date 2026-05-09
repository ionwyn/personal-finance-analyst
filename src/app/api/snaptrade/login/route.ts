import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { createSnapTradeConnectionPortal } from "@/lib/snaptrade/client";

const bodySchema = z
  .object({
    reconnectAuthorizationId: z.string().min(1).optional()
  })
  .optional();

export async function POST(request: Request) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const body = bodySchema.parse(await request.json().catch(() => undefined));
  const portal = await createSnapTradeConnectionPortal({
    reconnectAuthorizationId: body?.reconnectAuthorizationId
  });

  return NextResponse.json(portal);
}
