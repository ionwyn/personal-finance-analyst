import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";
import { rateLimitRequest } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export function GET(request: Request) {
  return handler(request);
}

export function POST(request: Request) {
  const limited = rateLimitRequest(request, {
    keyPrefix: "auth",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  return handler(request);
}
