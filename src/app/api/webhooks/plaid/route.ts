import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { assertWebhookConfig } from "@/lib/env";
import { logger, setLogContext, withRequestLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { verifyPlaidWebhook } from "@/lib/plaid/webhook";
import { rateLimitRequest } from "@/lib/rate-limit";

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
};

export async function POST(request: Request) {
  return withRequestLogging(
    request,
    { route: "/api/webhooks/plaid", provider: "plaid", syncSource: "webhook" },
    async () => {
      const limited = rateLimitRequest(request, {
        keyPrefix: "webhooks:plaid",
        limit: 120,
        windowMs: 60_000,
      });
      if (limited) return limited;

      assertWebhookConfig();

      const rawBody = await request.text();
      const signedJwt = request.headers.get("plaid-verification");

      const verified = await verifyPlaidWebhook(rawBody, signedJwt);
      if (!verified) {
        return NextResponse.json({ error: "Invalid Plaid webhook signature" }, { status: 401 });
      }

      const body = JSON.parse(rawBody) as PlaidWebhookBody;
      if (
        body.webhook_type === "TRANSACTIONS" &&
        body.webhook_code === "SYNC_UPDATES_AVAILABLE" &&
        body.item_id
      ) {
        const item = await prisma.plaidItem.findUnique({
          where: { plaidItemId: body.item_id },
        });

        if (item) {
          setLogContext({ tenantId: item.tenantId });
          await syncPlaidItem(item.id, SyncSource.WEBHOOK);
        }
      } else if (
        body.webhook_type === "ITEM" &&
        body.webhook_code === "NEW_ACCOUNTS_AVAILABLE" &&
        body.item_id
      ) {
        logger.info(
          {
            webhookType: body.webhook_type,
            webhookCode: body.webhook_code,
          },
          "plaid new accounts webhook received"
        );
      }

      return NextResponse.json({ ok: true });
    }
  );
}
