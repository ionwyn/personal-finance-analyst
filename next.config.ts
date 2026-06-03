import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in src/middleware.ts so it can
// carry a unique nonce (enabling a strict, no-'unsafe-inline' script-src).
// The static headers below still apply to all responses, including the static
// assets that the middleware matcher excludes.
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
    ];
  },
};

export default nextConfig;
