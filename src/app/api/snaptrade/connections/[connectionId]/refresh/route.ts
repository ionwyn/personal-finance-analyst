import { NextResponse } from "next/server";

import { requireOwnedSnapTradeConnection } from "@/lib/http";
import { refreshSnapTradeConnection } from "@/lib/snaptrade/sync";

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  const auth = await requireOwnedSnapTradeConnection(connectionId);
  if (!("connection" in auth)) return auth.error;

  const result = await refreshSnapTradeConnection({
    tenantId: auth.tenant.id,
    connectionId: auth.connection.id,
  });

  return NextResponse.json(result);
}
