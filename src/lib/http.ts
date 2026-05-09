import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTenant } from "@/lib/tenant";

export async function requireUserTenant() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) {
    return { error: NextResponse.json({ error: "Tenant not found" }, { status: 404 }) };
  }

  return { session, tenant };
}

export async function requireOwnedPlaidItem(itemId: string) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth;

  const item = await prisma.plaidItem.findFirst({
    where: {
      id: itemId,
      tenantId: auth.tenant.id
    },
    include: {
      tenant: true
    }
  });

  if (!item) {
    return { error: NextResponse.json({ error: "Plaid Item not found" }, { status: 404 }) };
  }

  return { ...auth, item };
}

export async function requireOwnedSnapTradeConnection(connectionId: string) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth;

  const connection = await prisma.snapTradeConnection.findFirst({
    where: {
      id: connectionId,
      tenantId: auth.tenant.id
    }
  });

  if (!connection) {
    return { error: NextResponse.json({ error: "SnapTrade connection not found" }, { status: 404 }) };
  }

  return { ...auth, connection };
}

export async function requireOwnedSnapTradeLogo(logoId: string) {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth;

  const position = await prisma.snapTradePosition.findFirst({
    where: {
      tenantId: auth.tenant.id,
      logoId
    },
    select: { id: true }
  });

  if (!position) {
    return { error: NextResponse.json({ error: "SnapTrade logo not found" }, { status: 404 }) };
  }

  return { ...auth, logoId };
}
