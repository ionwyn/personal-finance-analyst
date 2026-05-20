import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createSnapTradeConnectionPortal } from "@/lib/snaptrade/client";

const bodySchema = z
  .object({
    reconnectAuthorizationId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/login", provider: "snaptrade" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "snaptrade:login",
        limit: 10,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const auth = await requireUserTenant();
      if ("error" in auth) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const body = bodySchema.parse(await request.json().catch(() => undefined));
      const portal = await createSnapTradeConnectionPortal({
        reconnectAuthorizationId: body?.reconnectAuthorizationId,
      });

      return NextResponse.json(portal);
    }
  );
}
