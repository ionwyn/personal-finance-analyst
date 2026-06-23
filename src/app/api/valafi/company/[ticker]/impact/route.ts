import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getImpact } from "@/lib/valafi/service";

// Disruption-impact cascade for one company. Cached per
// (ticker, disruption_type, severity bucket, max_hops).
export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  return withRequestLogging(request, { route: "/api/valafi/company/[ticker]/impact" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:impact",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const { ticker } = await context.params;
    const params = new URL(request.url).searchParams;
    const result = await getImpact(ticker, {
      disruptionType: params.get("disruption_type") ?? undefined,
      severity: params.has("severity") ? Number(params.get("severity")) : undefined,
      maxHops: params.has("max_hops") ? Number(params.get("max_hops")) : undefined,
      confirm: params.get("confirm") === "1",
    });
    return NextResponse.json(result);
  });
}
