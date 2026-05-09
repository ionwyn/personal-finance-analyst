import { SyncSource } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireUserTenant } from "@/lib/http";
import { syncSnapTradeTenant } from "@/lib/snaptrade/sync";

export async function POST() {
  const auth = await requireUserTenant();
  if ("error" in auth) return auth.error;

  const run = await syncSnapTradeTenant(auth.tenant.id, SyncSource.MANUAL);
  return NextResponse.json({ sync_run: run });
}
