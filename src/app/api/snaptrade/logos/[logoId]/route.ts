import { NextResponse } from "next/server";

import { requireOwnedSnapTradeLogo } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { fetchAndCacheLogo } from "@/lib/snaptrade/logo";

export async function GET(request: Request, context: { params: Promise<{ logoId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/logos/[logoId]", provider: "twelvedata" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "snaptrade:logos",
        limit: 300,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const { logoId } = await context.params;
      const auth = await requireOwnedSnapTradeLogo(logoId);
      if (!("logoId" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const logo = await fetchAndCacheLogo(logoId);
      if (!logo?.data || !logo.contentType || logo.status !== "READY") {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Cache-Control": "private, max-age=300",
          },
        });
      }

      return new NextResponse(logo.data, {
        status: 200,
        headers: {
          "Content-Type": logo.contentType,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  );
}
