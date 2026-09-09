// Public surface of @repo/database. Consumers never import from src/generated directly.
export { Prisma } from "./generated/prisma/client";
export type { HealthCheck } from "./generated/prisma/client";

export {
  createPrismaClient,
  disconnectPrismaClient,
  getPrismaClient,
  type CreatePrismaClientOptions,
  type PrismaClient,
} from "./client";
// Repositories: add `export * from "./repositories/<entity>.repository";` per aggregate
// (see .claude/rules/module-template.md). None exist yet in Phase 0.
export * from "./utils/errors";
export * from "./utils/pagination";
export * from "./utils/transaction";
