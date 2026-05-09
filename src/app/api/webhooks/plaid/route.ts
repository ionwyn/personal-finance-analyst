import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { assertWebhookConfig } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { verifyPlaidWebhook } from "@/lib/plaid/webhook";

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
};

export async function POST(request: Request) {
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
      where: { plaidItemId: body.item_id }
    });

    if (item) {
      await syncPlaidItem(item.id, SyncSource.WEBHOOK);
    }
  }

  return NextResponse.json({ ok: true });
}
