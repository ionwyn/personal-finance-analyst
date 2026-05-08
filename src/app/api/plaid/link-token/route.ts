import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { createTransactionsLinkToken } from "@/lib/plaid/client";

export async function POST() {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const userId = auth.session.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const linkToken = await createTransactionsLinkToken(userId);
  return NextResponse.json({ link_token: linkToken });
}
