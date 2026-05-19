import { NextResponse } from "next/server";

import { recordHealthCheck } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "NEXTAUTH_SECRET", "CRON_SECRET"];
const DATABASE_TIMEOUT_MS = 2_000;

export async function GET() {
  const startedAt = performance.now();
  const missingEnv = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  const database = await checkDatabase();
  const ok = missingEnv.length === 0 && database.ok;

  recordHealthCheck({
    check: "ready",
    durationSeconds: (performance.now() - startedAt) / 1000,
    result: ok ? "success" : "failure",
  });

  return NextResponse.json(
    {
      ok,
      status: ok ? "ready" : "not_ready",
      checks: {
        database,
        environment: {
          ok: missingEnv.length === 0,
          missing: missingEnv,
        },
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}

async function checkDatabase() {
  const startedAt = performance.now();

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_TIMEOUT_MS);
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
