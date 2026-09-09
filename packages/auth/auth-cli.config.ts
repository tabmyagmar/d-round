// Used only by `npx auth generate` (Better Auth CLI) to emit the Prisma models.
// The prisma instance is never queried during schema generation.
import { createAuth } from "./src/server";

export const auth = createAuth({
  prisma: {} as never,
  secret: "cli-only-secret-not-used-at-runtime",
  baseURL: "http://localhost:4000",
  trustedOrigins: ["http://localhost:3000"],
  sendVerificationEmail: () => Promise.resolve(),
});
