import { NextResponse } from "next/server";

import { requireOwnedSnapTradeConnection } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { removeSnapTradeConnection } from "@/lib/snaptrade/sync";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/connections/[connectionId]", provider: "snaptrade" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "snaptrade:connection-delete",
        limit: 10,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const { connectionId } = await context.params;
      const auth = await requireOwnedSnapTradeConnection(connectionId);
      if (!("connection" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      await removeSnapTradeConnection({
        tenantId: auth.tenant.id,
        connectionId: auth.connection.id,
      });

      return NextResponse.json({ ok: true });
    }
  );
}
