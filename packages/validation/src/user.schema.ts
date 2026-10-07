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

/**
 * Roles a caller may give another user (invite, role change), from the legacy role picker:
 * `super_admin` is never assigned through the app, a manager hands out manager or staff, staff
 * nothing. The API enforces it; the web only renders what it returns.
 */
const ASSIGNABLE_ROLES: Readonly<Record<Role, readonly Role[]>> = {
  super_admin: ["admin", "manager", "staff"],
  admin: ["admin", "manager", "staff"],
  manager: ["manager", "staff"],
  staff: [],
};
export const assignableRoles = (callerRole: Role): readonly Role[] => ASSIGNABLE_ROLES[callerRole];

/** Roles whose grants may be adjusted per user (`user_permissions` ALLOW / DENY rows). */
export const OVERRIDABLE_ROLES = ["manager"] as const satisfies readonly Role[];
export const isOverridableRole = (role: string): boolean =>
  (OVERRIDABLE_ROLES as readonly string[]).includes(role);

export const emailSchema = z
  .email({
    error: (issue) =>
      issue.input === ""
        ? "メールアドレスを入力してください"
        : "メールアドレスの形式が正しくありません",
  })
  .max(255, { error: "メールアドレスは255文字以内で入力してください" });

/**
 * THE password policy: 8–128 characters with at least one letter and one digit. The forms parse
 * with it, and the API enforces it on every path that sets a password (the Better Auth hook in
 * packages/auth). Sign-in never applies it, so tightening the policy locks nobody out.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: "パスワードは8文字以上で入力してください" })
  .max(128, { error: "パスワードは128文字以内で入力してください" })
  .regex(/[A-Za-z]/, { error: "英字を1文字以上含めてください" })
  .regex(/\d/, { error: "数字を1文字以上含めてください" });

export const nameSchema = z.string().trim().min(1).max(100);

const confirmPasswordSchema = z.string().min(1, { error: "パスワードを再度入力してください" });
const PASSWORD_MISMATCH = "パスワードが一致していません";

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { error: "パスワードを入力してください" })
    .max(128, { error: "パスワードは128文字以内で入力してください" }),
  /** Off: the session cookie ends with the browser (Better Auth `rememberMe`). */
  rememberMe: z.boolean(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** The set/reset form; the token comes from the URL, not from a field. */
export const resetPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: confirmPasswordSchema })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: PASSWORD_MISMATCH,
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "現在のパスワードを入力してください" }),
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    error: "現在のパスワードと異なるパスワードを入力してください",
    path: ["newPassword"],
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: PASSWORD_MISMATCH,
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const userIdSchema = z.object({ userId: idSchema });

/** Self edit when `userId` is omitted; admins may pass another user's id. */
export const updateProfileSchema = z.object({
  userId: idSchema.optional(),
  name: nameSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** An admin creates a user without a password; the user sets one from the invitation mail. */
export const inviteUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  role: roleSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const changeRoleSchema = z.object({
  userId: idSchema,
  role: roleSchema,
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

/** Columns the user list may be sorted by; anything else is rejected, never passed to Prisma. */
export const USER_SORT_FIELDS = ["name", "email", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
/** `active` users can sign in; `deactivated` ones are soft-deleted (`deletedAt` set). */
export const USER_STATUSES = ["active", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const listUsersSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  status: z.enum(USER_STATUSES).default("active"),
  sortBy: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDERS).default("desc"),
});
export type ListUsersInput = z.input<typeof listUsersSchema>;
export type ListUsersQuery = z.output<typeof listUsersSchema>;
