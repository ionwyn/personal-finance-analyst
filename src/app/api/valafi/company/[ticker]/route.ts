import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getCompanyBundle } from "@/lib/valafi/service";

// Company supply-chain bundle (profile + suppliers + customers + competitors +
// exposure). ?peek=1 reads cache only; ?confirm=1 authorises spending a ticker
// slot when near the daily cap. The response envelope's `status`/`needsConfirm`
// tell the client what happened.
export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
  return withRequestLogging(request, { route: "/api/valafi/company/[ticker]" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:company",
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const { ticker } = await context.params;
    const params = new URL(request.url).searchParams;
    const result = await getCompanyBundle(ticker, {
      confirm: params.get("confirm") === "1",
      peek: params.get("peek") === "1",
    });
    return NextResponse.json(result);
  });
}
