import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { withRequestLogging } from "@/lib/logger";
import { syncAllPlaidItems } from "@/lib/plaid/sync";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/jobs/plaid-sync", provider: "plaid", syncSource: "scheduled" },
    async () => {
      if (!isCronAuthorized(request.headers, process.env.CRON_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const runs = await syncAllPlaidItems(SyncSource.SCHEDULED);
      return NextResponse.json({
        ok: true,
        runs: runs.length,
      });
    }
  );
}

export const GET = POST;
