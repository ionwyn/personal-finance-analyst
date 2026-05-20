import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { exchangeAndStorePlaidItem } from "@/lib/plaid/items";
import { rateLimitRequest } from "@/lib/rate-limit";

const bodySchema = z.object({
  public_token: z.string().min(1),
  institution: z
    .object({
      institution_id: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/exchange-public-token", provider: "plaid", syncSource: "manual" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:exchange-public-token",
        limit: 10,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const auth = await requireUserTenant();
      if ("error" in auth) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const userId = auth.session.user?.id;
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const body = bodySchema.parse(await request.json());
      const item = await exchangeAndStorePlaidItem({
        tenantId: auth.tenant.id,
        userId,
        publicToken: body.public_token,
        institutionId: body.institution?.institution_id,
        institutionName: body.institution?.name,
      });

      return NextResponse.json({ item_id: item.id });
    }
  );
}
