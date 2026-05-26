import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { createUpdateLinkToken } from "@/lib/plaid/client";
import { rateLimitRequest } from "@/lib/rate-limit";
import { decryptToken } from "@/lib/security/token-crypto";

/**
 * Create a Link token in update mode so the user can re-authenticate an item
 * that needs it (typically ITEM_LOGIN_REQUIRED → status ERROR). The client opens
 * Plaid Link with this token; on success the existing item is repaired in place.
 */
export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/items/[itemId]/update-link-token", provider: "plaid" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:update-link-token",
        limit: 10,
        windowMs: 60_000,
      });
      if (limited) return limited;

      const invalidOrigin = validateRequestOrigin(request);
      if (invalidOrigin) return invalidOrigin;

      const { itemId } = await context.params;
      const auth = await requireOwnedPlaidItem(itemId);
      if (!("item" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const userId = auth.session.user?.id;
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const accessToken = decryptToken(auth.item.accessTokenEncrypted);
      const linkToken = await createUpdateLinkToken(userId, accessToken);
      return NextResponse.json({ link_token: linkToken });
    }
  );
}
