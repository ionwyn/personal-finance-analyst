import { SyncRunStatus, SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { withRequestLogging } from "@/lib/logger";
import { recordSyncJob, recordSyncRunStatuses } from "@/lib/metrics";
import { syncAllPlaidItems } from "@/lib/plaid/sync";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/jobs/plaid-sync", provider: "plaid", syncSource: "scheduled" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "jobs:plaid-sync",
        limit: 20,
        windowMs: 60_000,
      });
      if (limited) return limited;

      if (!isCronAuthorized(request.headers, process.env.CRON_SECRET)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const startedAt = performance.now();

      try {
        const runs = await syncAllPlaidItems(SyncSource.SCHEDULED);
        const result = runs.some((run) => run.status === SyncRunStatus.ERROR)
          ? "partial_error"
          : "success";

        recordSyncRunStatuses({ provider: "plaid", runs, source: SyncSource.SCHEDULED });
        recordSyncJob({
          durationSeconds: (performance.now() - startedAt) / 1000,
          provider: "plaid",
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
          provider: "plaid",
          result: "error",
          source: SyncSource.SCHEDULED,
        });
        throw error;
      }
    }
  );
}

export const GET = POST;
