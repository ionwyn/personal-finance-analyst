import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { refreshBalancesForItem } from "@/lib/plaid/accounts";

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  const auth = await requireOwnedPlaidItem(itemId);
  if (!("item" in auth)) return auth.error;

  const result = await refreshBalancesForItem(auth.item.id);
  return NextResponse.json(result);
}
