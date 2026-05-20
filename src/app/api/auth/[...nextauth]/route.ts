import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { rateLimitRequest } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

type RouteContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

export function GET(request: NextRequest, context: RouteContext) {
  return handler(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  const limited = rateLimitRequest(request, {
    keyPrefix: "auth",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  return handler(request, context);
}
