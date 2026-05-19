import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { withRequestLogging } from "@/lib/logger";
import { syncAllSnapTradeTenants } from "@/lib/snaptrade/sync";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/jobs/snaptrade-sync", provider: "snaptrade", syncSource: "scheduled" },
    async () => {
      if (!isCronAuthorized(request.headers, process.env.CRON_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const runs = await syncAllSnapTradeTenants(SyncSource.SCHEDULED);
      return NextResponse.json({
        ok: true,
        runs: runs.length,
      });
    }
  );
}

export const GET = POST;
