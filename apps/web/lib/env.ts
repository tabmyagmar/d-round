/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined at build time by
 * Next.js; anything secret must never be read here.
 */
export const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
} as const;
