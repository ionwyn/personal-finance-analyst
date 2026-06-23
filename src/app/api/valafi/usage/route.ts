import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";

// Quota meter. Reads local counters every call; reconciles with Vala-Fi's
// /dev/usage once a day, or on ?refresh=1 (the meter's manual refresh button).
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/usage" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:usage",
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const forceRemote = new URL(request.url).searchParams.get("refresh") === "1";
    const usage = await getUsage({ forceRemote });
    return NextResponse.json({ usage });
  });
}
