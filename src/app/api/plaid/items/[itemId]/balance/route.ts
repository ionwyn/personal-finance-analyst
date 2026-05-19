import { NextResponse } from "next/server";

import { requireOwnedPlaidItem } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { refreshBalancesForItem } from "@/lib/plaid/accounts";

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return withRequestLogging(
    request,
    { route: "/api/plaid/items/[itemId]/balance", provider: "plaid", syncSource: "manual" },
    async () => {
      const { itemId } = await context.params;
      const auth = await requireOwnedPlaidItem(itemId);
      if (!("item" in auth)) return auth.error;

      setLogContext({ tenantId: auth.tenant.id });

      const result = await refreshBalancesForItem(auth.item.id);
      return NextResponse.json(result);
    }
  );
}
