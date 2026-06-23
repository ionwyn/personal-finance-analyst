import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getChangesFeed } from "@/lib/valafi/service";

function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

// Cross-company "what changed" feed. One request, cached 12h.
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/feed" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:feed",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const params = new URL(request.url).searchParams;
    const since = params.get("since") || defaultSince();
    const tickers = params
      .get("tickers")
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await getChangesFeed({ since, tickers });
    return NextResponse.json(result);
  });
}
