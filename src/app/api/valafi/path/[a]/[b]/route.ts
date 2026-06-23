import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { getPath } from "@/lib/valafi/service";

// Shortest supply-chain path between two companies (six-degrees). May spend up
// to two ticker slots; ?confirm=1 authorises spending near the daily cap.
export async function GET(
  request: Request,
  context: { params: Promise<{ a: string; b: string }> }
) {
  return withRequestLogging(request, { route: "/api/valafi/path/[a]/[b]" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "valafi:path",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const auth = await requireUserTenant();
    if ("error" in auth) return auth.error;

    const { a, b } = await context.params;
    const confirm = new URL(request.url).searchParams.get("confirm") === "1";
    const result = await getPath(a, b, { confirm });
    return NextResponse.json(result);
  });
}
