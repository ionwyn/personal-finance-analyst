import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { createTransactionsLinkToken } from "@/lib/plaid/client";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/link-token", provider: "plaid" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:link-token",
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

      const linkToken = await createTransactionsLinkToken(userId);
      return NextResponse.json({ link_token: linkToken });
    }
  );
}
