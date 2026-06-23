import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getUsage } from "@/lib/valafi/governor";
import { getRegisteredPortfolioId } from "@/lib/valafi/portfolio";
import { simulatePortfolio } from "@/lib/valafi/service";

const bodySchema = z.object({ ticker: z.string().min(1).max(12) });

// "If <ticker> were disrupted, which of my holdings get hit, and how hard?"
export async function POST(request: Request) {
  return withRequestLogging(request, { route: "/api/valafi/portfolio/simulate" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:pf-simulate",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const parsed = await parseJson(request, bodySchema);
    if ("error" in parsed) return parsed.error;

    const portfolioId = await getRegisteredPortfolioId(auth.tenant.id);
    if (portfolioId == null) {
      return NextResponse.json({ data: null, status: "unregistered", usage: await getUsage() });
    }
    return NextResponse.json(await simulatePortfolio(portfolioId, parsed.data.ticker));
  });
}
