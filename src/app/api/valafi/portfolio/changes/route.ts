import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";
import { getRegisteredPortfolioId } from "@/lib/valafi/portfolio";
import { getPortfolioChanges } from "@/lib/valafi/service";

function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

// Relationship changes since a date, scoped to the registered portfolio.
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio/changes" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:pf-changes",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const portfolioId = await getRegisteredPortfolioId(auth.tenant.id);
    if (portfolioId == null) {
      return NextResponse.json({ data: null, status: "unregistered", usage: await getUsage() });
    }
    const since = new URL(request.url).searchParams.get("since") || defaultSince();
    return NextResponse.json(await getPortfolioChanges(portfolioId, since));
  });
}
