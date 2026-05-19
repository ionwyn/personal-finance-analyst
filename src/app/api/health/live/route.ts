import { NextResponse } from "next/server";

import { recordHealthCheck } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const startedAt = performance.now();
  recordHealthCheck({
    check: "live",
    durationSeconds: (performance.now() - startedAt) / 1000,
    result: "success",
  });

  return NextResponse.json({
    ok: true,
    status: "live",
    timestamp: new Date().toISOString(),
  });
}
