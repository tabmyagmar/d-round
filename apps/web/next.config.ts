import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them like app code.
  transpilePackages: ["@repo/ui", "@repo/validation", "@repo/auth", "@repo/permissions"],
};

export default nextConfig;
