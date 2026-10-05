// Public surface of @repo/database. Consumers never import from src/generated directly.
export { OutboxStatus, Prisma, SourceArea } from "./generated/prisma/client";
export type {
  Account,
  HealthCheck,
  OutboxEmail,
  Session,
  SourceAddress,
  SourcePrefecture,
  SourceRegion,
  User,
  Verification,
} from "./generated/prisma/client";

export {
  createPrismaClient,
  disconnectPrismaClient,
  getPrismaClient,
  type CreatePrismaClientOptions,
  type PrismaClient,
} from "./client";
export * from "./repositories";
export * from "./utils/errors";
export * from "./utils/pagination";
export * from "./utils/transaction";
