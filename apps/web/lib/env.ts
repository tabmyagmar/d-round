import { z } from "@repo/validation";
import { createEnv } from "@repo/validation/env";
import type { EnvSource } from "@repo/validation/env";

/**
 * Public (browser-safe) configuration, validated like the api and worker env. NEXT_PUBLIC_*
 * values are inlined at build time, so they must be referenced as `process.env.NEXT_PUBLIC_X`
 * literally (below); anything secret must never be read here.
 */
const publicEnvShape = {
  /** API origin the browser and the server components call (`localhost:4000` without a scheme
   * would parse as a URL with protocol "localhost", hence the explicit http(s) check). */
  NEXT_PUBLIC_API_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:4000"),
};

export type PublicEnv = { apiUrl: string };

/** Throws `EnvValidationError` on a malformed value instead of building a broken client. */
export const loadPublicEnv = (source: EnvSource): PublicEnv => {
  const env = createEnv(publicEnvShape, source);
  return { apiUrl: env.NEXT_PUBLIC_API_URL };
};

export const publicEnv: PublicEnv = loadPublicEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
