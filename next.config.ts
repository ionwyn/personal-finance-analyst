import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in src/middleware.ts (via
// src/proxy.ts) so it can carry a unique nonce per request, enabling a strict
// no-'unsafe-inline' script-src. The static headers below apply to all
// responses including static assets the middleware matcher excludes.
const isPrivate = process.env.DEPLOYMENT_MODE !== "demo";

const nextConfig: NextConfig = {
  typedRoutes: true,
  sassOptions: {
    loadPaths: ["src/styles"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Suppress search-engine indexing on the private deployment.
          ...(isPrivate ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
