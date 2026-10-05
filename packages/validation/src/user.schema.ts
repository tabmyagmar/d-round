import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";

/**
 * Single-tenant role set: the keys of the role catalog (`roles` table, seeded from
 * packages/database/prisma/seed/roles.seed.ts). Better Auth stores it as a string; this enum is
 * the allowed set.
 */
export const ROLES = ["super_admin", "admin", "manager", "staff"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
export const DEFAULT_ROLE: Role = "staff";
/**
 * The admin role set, used for two authorization decisions: Better Auth `adminRoles` (who may
 * call privileged admin-plugin endpoints) and the roles the last-admin rule counts
 * (`countActiveAdmins` in the user service). Read-only; spread it where a mutable array is needed.
 */
export const ADMIN_ROLES = ["super_admin", "admin"] as const satisfies readonly Role[];

export const emailSchema = z.email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().trim().min(1).max(100);

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignInInput = z.infer<typeof signInSchema>;

export const userIdSchema = z.object({ userId: idSchema });

/** Self edit when `userId` is omitted; admins may pass another user's id. */
export const updateProfileSchema = z.object({
  userId: idSchema.optional(),
  name: nameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeRoleSchema = z.object({
  userId: idSchema,
  role: roleSchema,
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
});
export type ListUsersInput = z.input<typeof listUsersSchema>;
export type ListUsersQuery = z.output<typeof listUsersSchema>;
