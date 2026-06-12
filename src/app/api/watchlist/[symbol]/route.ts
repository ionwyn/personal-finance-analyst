import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { validateRequestOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const invalidOrigin = validateRequestOrigin(request);
  if (invalidOrigin) return invalidOrigin;

  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim().toUpperCase();

  const deleted = await prisma.watchlistItem.deleteMany({
    where: { tenantId: auth.tenant.id, symbol },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not on watchlist" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
