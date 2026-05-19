import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  sassOptions: {
    loadPaths: ["src/styles"],
  },
};

export default nextConfig;
