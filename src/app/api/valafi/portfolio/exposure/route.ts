import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";
import { getRegisteredPortfolioId } from "@/lib/valafi/portfolio";
import { getPortfolioExposure } from "@/lib/valafi/service";

// Aggregate shared-supplier exposure & concentration risk across holdings.
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio/exposure" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:pf-exposure",
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
    return NextResponse.json(await getPortfolioExposure(portfolioId));
  });
}
