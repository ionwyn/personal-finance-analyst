import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { createTransactionsLinkToken } from "@/lib/plaid/client";

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/link-token", provider: "plaid" },
    async () => {
      const auth = await requireUserTenant();
      if ("error" in auth) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const userId = auth.session.user?.id;
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const linkToken = await createTransactionsLinkToken(userId);
      return NextResponse.json({ link_token: linkToken });
    }
  );
}
