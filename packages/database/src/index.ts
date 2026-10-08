// Public surface of @repo/database. Consumers never import from src/generated directly.
export {
  CommentFor,
  OutboxStatus,
  PermissionEffect,
  Prisma,
  SourceArea,
} from "./generated/prisma/client";
export type {
  Account,
  CommentTemplate,
  HealthCheck,
  OutboxEmail,
  Permission,
  Role as RoleRecord,
  RolePermission,
  Session,
  SourceAddress,
  SourcePrefecture,
  SourceRegion,
  User,
  UserPermission,
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
