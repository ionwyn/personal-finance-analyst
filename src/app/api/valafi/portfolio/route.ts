import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { getInvestmentDashboardData } from "@/lib/investments/analytics";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";
import { ensurePortfolio, getRegisteredPortfolioId } from "@/lib/valafi/portfolio";

// GET: registration status. POST: register (or re-register) the tenant's
// holdings as a Vala-Fi portfolio. The POST brackets registration with a
// /dev/usage read so it can report exactly how much quota it cost — surfacing
// whether portfolio registration consumes the unique-ticker budget.
export async function GET(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:portfolio-status",
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const [portfolioId, usage] = await Promise.all([
      getRegisteredPortfolioId(auth.tenant.id),
      getUsage(),
    ]);
    return NextResponse.json({ registered: portfolioId != null, portfolioId, usage });
  });
}

export async function POST(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:portfolio-register",
      limit: 6,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;
    setLogContext({ tenantId: auth.tenant.id });

    const data = await getInvestmentDashboardData(auth.tenant.id);
    const raw = data.holdings.map((h) => ({ ticker: h.symbol, value: h.mvCAD }));

    const before = await getUsage({ forceRemote: true });
    const result = await ensurePortfolio(auth.tenant.id, raw);
    const after = await getUsage({ forceRemote: true });

    return NextResponse.json({
      result,
      measured: {
        tickerDelta: Math.max(0, after.uniqueTickers - before.uniqueTickers),
        requestDelta: Math.max(0, after.requests - before.requests),
      },
      usage: after,
    });
  });
}
