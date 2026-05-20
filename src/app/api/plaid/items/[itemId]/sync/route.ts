import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/items/[itemId]/sync", provider: "plaid", syncSource: "manual" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:item-sync",
        limit: 12,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const { itemId } = await context.params;
      const auth = await requireOwnedPlaidItem(itemId);
      if (!("item" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const run = await syncPlaidItem(auth.item.id, SyncSource.MANUAL);
      return NextResponse.json({ sync_run: run });
    }
  );
}
