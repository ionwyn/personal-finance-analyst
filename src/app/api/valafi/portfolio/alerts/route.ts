import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";
import { getRegisteredPortfolioId } from "@/lib/valafi/portfolio";
import { getPortfolioAlerts } from "@/lib/valafi/service";

// Proactive alerts on supply-chain shifts affecting any holding.
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio/alerts" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:pf-alerts",
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
    return NextResponse.json(await getPortfolioAlerts(portfolioId));
  });
}
