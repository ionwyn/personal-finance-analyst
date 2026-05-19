import { NextResponse } from "next/server";

import { requireOwnedSnapTradeConnection } from "@/lib/http";
import { removeSnapTradeConnection } from "@/lib/snaptrade/sync";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  const auth = await requireOwnedSnapTradeConnection(connectionId);
  if (!("connection" in auth)) return auth.error;

  await removeSnapTradeConnection({
    tenantId: auth.tenant.id,
    connectionId: auth.connection.id,
  });

  return NextResponse.json({ ok: true });
}
