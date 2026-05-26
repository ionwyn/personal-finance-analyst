import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { logger, safeError, setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { removePlaidItem } from "@/lib/plaid/client";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";
import { decryptToken } from "@/lib/security/token-crypto";

/**
 * Unlink a Plaid item: revoke the access token with Plaid (`/item/remove`),
 * then hard-delete the item and its data. Accounts, transactions, balance
 * snapshots, and sync runs cascade off the PlaidItem foreign keys.
 *
 * Plaid revocation is best-effort — if the token is already invalid or Plaid
 * is unreachable, we still purge the local rows so the connection is removed.
 */
export async function DELETE(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/items/[itemId]", provider: "plaid" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "plaid:item-unlink",
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

      try {
        const accessToken = decryptToken(auth.item.accessTokenEncrypted);
        await removePlaidItem(accessToken);
      } catch (error) {
        // Token already invalid / Plaid unreachable — proceed with local purge.
        logger.warn(
          { itemId: auth.item.id, error: safeError(error) },
          "plaid item remove failed; deleting local data anyway"
        );
      }

      await prisma.plaidItem.delete({ where: { id: auth.item.id } });

      return NextResponse.json({ ok: true });
    }
  );
}
