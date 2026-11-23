import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Pages already visited stay instant for a short while (clicking back, or
    // between two pages). Saving something clears them, so nothing goes stale.
    staleTimes: { dynamic: 30, static: 300 },
    // Only ship the icons actually used.
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
