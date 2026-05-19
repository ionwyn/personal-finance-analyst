import { NextResponse } from "next/server";

import { requireOwnedSnapTradeConnection } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { refreshSnapTradeConnection } from "@/lib/snaptrade/sync";

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  return withRequestLogging(
    request,
    {
      route: "/api/snaptrade/connections/[connectionId]/refresh",
      provider: "snaptrade",
      syncSource: "manual",
    },
    async () => {
      const { connectionId } = await context.params;
      const auth = await requireOwnedSnapTradeConnection(connectionId);
      if (!("connection" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const result = await refreshSnapTradeConnection({
        tenantId: auth.tenant.id,
        connectionId: auth.connection.id,
      });

      return NextResponse.json(result);
    }
  );
}
