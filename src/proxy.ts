import { NextResponse, type NextRequest } from "next/server";

import { rateLimitRequest } from "@/lib/rate-limit";

// Generous global cap applied to every /api/* request as a safety net. It sits
// above the stricter per-route limits (10–30/min on sensitive endpoints), so
// those still bite first for their own paths, while routes without a dedicated
// limit (settings, cycles, metrics, export) still get baseline abuse
// protection. 300/min comfortably clears a heavy page load's burst of calls.
const GLOBAL_API_LIMIT = 300;
const GLOBAL_API_WINDOW_MS = 60_000;

// Per-request nonce-based Content-Security-Policy.
//
// The nonce is generated here, injected into the request headers (so Next.js
// can stamp it onto its own framework/bootstrap <script> tags), and set on the
// response CSP header. This lets us drop `'unsafe-inline'` from script-src,
// which is the meaningful XSS hardening win.
//
// Notes on the remaining relaxations:
//   - style-src keeps 'unsafe-inline': React/Recharts emit inline `style=""`
//     attributes, which nonces cannot cover.
//   - 'unsafe-eval' is allowed only in development (Next.js fast refresh).
//   - cdn.plaid.com stays in the host allowlist for the Plaid Link script.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://cdn.plaid.com",
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.amazonaws.com",
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "connect-src 'self' https://*.plaid.com https://*.snaptrade.com https://api.github.com",
    "frame-src https://*.plaid.com https://*.snaptrade.com",
  ].join("; ");
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: enforce the global rate-limit envelope (skip health probes),
  // then pass through. CSP nonces are page-only, so no further work here.
  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/health")) return NextResponse.next();
    const limited = rateLimitRequest(request, {
      keyPrefix: "global",
      limit: GLOBAL_API_LIMIT,
      windowMs: GLOBAL_API_WINDOW_MS,
    });
    return limited ?? NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Expose the nonce to the request so Next.js nonces its own scripts, and so
  // any future first-party <script> can read it via `headers()`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on everything except static assets, which don't execute scripts.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};
