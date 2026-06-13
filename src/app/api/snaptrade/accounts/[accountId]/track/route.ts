import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJson, requireOwnedSnapTradeAccount } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";

const bodySchema = z.object({ tracked: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/snaptrade/accounts/[accountId]/track", provider: "snaptrade" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "snaptrade:account-track",
        limit: 30,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const { accountId } = await context.params;
      const auth = await requireOwnedSnapTradeAccount(accountId);
      if (!("account" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const parsed = await parseJson(request, bodySchema);
      if ("error" in parsed) return parsed.error;

      const updated = await prisma.snapTradeAccount.update({
        where: { id: auth.account.id },
        data: { tracked: parsed.data.tracked },
        select: { id: true, tracked: true },
      });

      return NextResponse.json({ account: updated });
    }
  );
}
