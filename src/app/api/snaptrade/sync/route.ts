import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { syncSnapTradeTenant } from "@/lib/snaptrade/sync";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/sync", provider: "snaptrade", syncSource: "manual" },
    async () => {
      const auth = await requireUserTenant();
      if ("error" in auth) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const run = await syncSnapTradeTenant(auth.tenant.id, SyncSource.MANUAL);
      return NextResponse.json({ sync_run: run });
    }
  );
}
