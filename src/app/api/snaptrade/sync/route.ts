import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { syncSnapTradeTenant } from "@/lib/snaptrade/sync";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/sync", provider: "snaptrade", syncSource: "manual" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "snaptrade:sync",
        limit: 12,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const auth = await requireUserTenant();
      if ("error" in auth) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const run = await syncSnapTradeTenant(auth.tenant.id, SyncSource.MANUAL);
      return NextResponse.json({ sync_run: run });
    }
  );
}
