import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them like app code.
  transpilePackages: ["@repo/ui", "@repo/validation"],
};

export default nextConfig;
