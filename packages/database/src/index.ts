// Public surface of @repo/database. Consumers never import from src/generated directly.
export {
  ClientOrderType,
  CommentFor,
  EmployeeType,
  FamilyRelation,
  Gender,
  GeneralStatus,
  OutboxStatus,
  PermissionEffect,
  Position,
  Prisma,
  SourceArea,
  StaffMemoType,
  StaffStatus,
} from "./generated/prisma/client";
export type {
  Account,
  Branch,
  BranchAddress,
  BranchCharger,
  Client,
  ClientAddress,
  ClientCharger,
  ClientRegion,
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
  Staff,
  StaffAddress,
  StaffCharger,
  StaffFamilyMember,
  StaffJobHistory,
  StaffMemo,
  StaffPrefecture,
  StaffRegion,
  User,
  UserPermission,
  UserProfile,
  UserProfileRegion,
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
