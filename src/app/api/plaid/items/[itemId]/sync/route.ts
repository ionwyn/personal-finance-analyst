import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { syncPlaidItem } from "@/lib/plaid/sync";

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const auth = await requireOwnedPlaidItem(itemId);
  if (!("item" in auth)) return auth.error;

  const run = await syncPlaidItem(auth.item.id, SyncSource.MANUAL);
  return NextResponse.json({ sync_run: run });
}
