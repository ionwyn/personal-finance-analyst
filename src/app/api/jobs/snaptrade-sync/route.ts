import { SyncRunStatus, SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { withRequestLogging } from "@/lib/logger";
import { recordSyncJob, recordSyncRunStatuses } from "@/lib/metrics";
import { syncAllSnapTradeTenants } from "@/lib/snaptrade/sync";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/jobs/snaptrade-sync", provider: "snaptrade", syncSource: "scheduled" },
    async () => {
      if (!isCronAuthorized(request.headers, process.env.CRON_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const startedAt = performance.now();

      try {
        const runs = await syncAllSnapTradeTenants(SyncSource.SCHEDULED);
        const result = runs.some((run) => run.status === SyncRunStatus.ERROR)
          ? "partial_error"
          : "success";

        recordSyncRunStatuses({ provider: "snaptrade", runs, source: SyncSource.SCHEDULED });
        recordSyncJob({
          durationSeconds: (performance.now() - startedAt) / 1000,
          provider: "snaptrade",
          result,
          source: SyncSource.SCHEDULED,
        });

        return NextResponse.json({
          ok: true,
          runs: runs.length,
        });
      } catch (error) {
        recordSyncJob({
          durationSeconds: (performance.now() - startedAt) / 1000,
          provider: "snaptrade",
          result: "error",
          source: SyncSource.SCHEDULED,
        });
        throw error;
      }
    }
  );
}

export const GET = POST;
