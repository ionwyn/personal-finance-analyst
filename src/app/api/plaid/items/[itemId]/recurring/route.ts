// DEBUG:recurring remove after rollout
//
// Force-fetch Plaid recurring streams for one item, bypassing the daily gate.
// Used to validate the integration without waiting for the scheduled sync. Still
// respects the ENABLE_PLAID_RECURRING kill-switch so it can never spend when the
// feature is turned off. Remove this route once the rollout is complete.
import { NextResponse } from "next/server";

import { isPlaidRecurringEnabled } from "@/lib/env";
import { requireOwnedPlaidItem } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { fetchAndStoreRecurring } from "@/lib/plaid/recurring";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/items/[itemId]/recurring", provider: "plaid", syncSource: "manual" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:item-recurring",
        limit: 6,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const { itemId } = await context.params;
      const auth = await requireOwnedPlaidItem(itemId);
      if (!("item" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      if (!isPlaidRecurringEnabled()) {
        return NextResponse.json(
          { error: "Plaid recurring is disabled (ENABLE_PLAID_RECURRING=false)." },
          { status: 409 }
        );
      }

      const result = await fetchAndStoreRecurring(auth.item.id, { force: true });
      return NextResponse.json({ ok: result != null, counts: result });
    }
  );
}
