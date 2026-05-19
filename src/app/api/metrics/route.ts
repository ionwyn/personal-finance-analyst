import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { collectPrometheusMetrics, recordMetricsScrape } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const authorization = authorizeMetricsRequest(request.headers);
  if (authorization) return authorization;

  recordMetricsScrape("success");
  return new Response(collectPrometheusMetrics(), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}

function authorizeMetricsRequest(headers: Headers) {
  const expectedToken = process.env.METRICS_TOKEN;

  if (!expectedToken && process.env.NODE_ENV === "production") {
    recordMetricsScrape("disabled");
    return NextResponse.json({ error: "Metrics endpoint is not configured." }, { status: 503 });
  }

  if (!expectedToken) return null;

  const providedToken = getMetricsToken(headers);
  if (providedToken && isSameToken(providedToken, expectedToken)) return null;

  recordMetricsScrape("unauthorized");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getMetricsToken(headers: Headers) {
  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return headers.get("x-metrics-token");
}

function isSameToken(providedToken: string, expectedToken: string) {
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
