import { z } from "zod";

import { idSchema, paginationSchema, requiredText } from "./common.schema";
import { permissionKeysSchema } from "./permission.schema";
import {
  areasSchema,
  regionCodeSchema,
  regionCodesSchema,
  sourceAreaSchema,
} from "./source.schema";

/**
 * Single-tenant role set: the keys of the role catalog (`roles` table, seeded from
 * packages/database/prisma/seed/roles.seed.ts). Better Auth stores it as a string; this enum is
 * the allowed set. `am` is the legacy STAFF role (labelled AM); the key `staff` stays free for a
 * future login role of スタッフ (ADR 0002, 2026-10-08).
 */
export const ROLES = ["super_admin", "admin", "manager", "am"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
export const DEFAULT_ROLE: Role = "am";
/**
 * The admin role set, used for two authorization decisions: Better Auth `adminRoles` (who may
 * call privileged admin-plugin endpoints) and the roles the last-admin rule counts
 * (`countActiveAdmins` in the user service). Read-only; spread it where a mutable array is needed.
 */
export const ADMIN_ROLES = ["super_admin", "admin"] as const satisfies readonly Role[];

/**
 * Roles a caller may give another user (invite, role change), from the legacy role picker:
 * `super_admin` is never assigned through the app, a manager hands out manager or AM, an AM
 * nothing. The API enforces it; the web only renders what it returns.
 */
const ASSIGNABLE_ROLES: Readonly<Record<Role, readonly Role[]>> = {
  super_admin: ["admin", "manager", "am"],
  admin: ["admin", "manager", "am"],
  manager: ["manager", "am"],
  am: [],
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

/** Full-width katakana with ー, ・ and spaces: the legacy rule for name readings (セイ / メイ). */
export const KATAKANA_PATTERN = /^[\u30A0-\u30FF\s]+$/u;

/**
 * A required katakana reading, e.g. `kanaSchema("セイ")`; `max` for longer names (a クライアント's
 * reading takes 100).
 */
export const kanaSchema = (label: string, max = 80) =>
  requiredText(label, max).regex(KATAKANA_PATTERN, { error: "全角カタカナで入力してください" });

/** 姓 / 名 and their readings セイ / メイ (legacy limits: 80 characters each). */
export const userNameSchema = z.object({
  lastName: requiredText("姓", 80),
  firstName: requiredText("名", 80),
  lastNameKana: kanaSchema("セイ"),
  firstNameKana: kanaSchema("メイ"),
});
export type UserNameInput = z.infer<typeof userNameSchema>;

/** The display name Better Auth keeps in `name`: "姓 名". */
export const fullName = (name: { lastName: string; firstName: string }): string =>
  `${name.lastName} ${name.firstName}`;

/** 役職 (legacy EnumPosition), in the legacy order. */
export const POSITIONS = [
  "EXECUTIVE",
  "AREA_MANAGER",
  "DISTRICT_MANAGER",
  "SV",
  "LEADER",
  "DISPATCH_COORDINATOR",
  "FULL_TIME_EMPLOYEE",
  "AREA_EMPLOYEE",
  "CONTRACT_EMPLOYEE",
  "SUBCONTRACT_STAFF",
  "DISPATCH_STAFF",
  "STAFF",
  "OTHER",
] as const;
export const positionSchema = z.enum(POSITIONS, { error: "役職を選択してください" });
export type Position = z.infer<typeof positionSchema>;

/** The largest 社員番号 / スタッフ番号: nine digits fit the database's integer column. */
export const EMPLOYEE_NUMBER_MAX = 999_999_999;

/**
 * A list search that is an employee number (one to nine digits, not zero) also matches the 社員番号
 * or スタッフ番号 (the legacy numeric search); `null` for any other search.
 */
export const employeeNumberOfSearch = (search: string): number | null => {
  const value = /^\d{1,9}$/.test(search) ? Number(search) : 0;
  return value > 0 ? value : null;
};

/** A required positive whole number with the legacy messages, e.g. `employeeNumberSchema("社員番号")`. */
export const employeeNumberSchema = (label: string) =>
  z
    .number({ error: `${label}は必須です` })
    .int({ error: `${label}は正の整数で入力してください` })
    .min(1, { error: `${label}は正の整数で入力してください` })
    .max(EMPLOYEE_NUMBER_MAX, { error: `${label}は9桁以内で入力してください` });

/**
 * A 担当者's HR fields (ADR 0007): 社員番号, 部署名, 役職, 退職日 (optional) and the エリア / 地域
 * they cover. Required on invite and edit, as every field but 退職日 was in the legacy form.
 */
export const userProfileSchema = z.object({
  employeeNumber: employeeNumberSchema("社員番号"),
  departmentName: requiredText("部署名", 80),
  position: positionSchema,
  /** `yyyy-MM-dd` (DateField), `null` when cleared. */
  retirementDate: z.iso.date({ error: "日付の形式が正しくありません" }).nullable(),
  areas: areasSchema.refine((areas) => areas.length > 0, { error: "エリアを選択してください" }),
  regionCodes: regionCodesSchema.refine((codes) => codes.length > 0, {
    error: "地域を選択してください",
  }),
});
export type UserProfileFormValues = z.input<typeof userProfileSchema>;
export type UserProfileInput = z.output<typeof userProfileSchema>;

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

/** The name parts, each optional: an edit sends only the parts that changed. */
const userNamePatchShape = userNameSchema.partial().shape;

/** Self edit when `userId` is omitted; admins may pass another user's id. */
export const updateProfileSchema = z.object({
  userId: idSchema.optional(),
  ...userNamePatchShape,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * An admin creates a user without a password; the user sets one from the invitation mail.
 * `permissionKeys` (the ticked child permissions) only for an overridable role (`OVERRIDABLE_ROLES`).
 * `profile`: the 担当者 HR fields, required as in the legacy form and saved with the user.
 */
export const inviteUserSchema = z.object({
  email: emailSchema,
  ...userNameSchema.shape,
  role: roleSchema,
  permissionKeys: permissionKeysSchema.optional(),
  profile: userProfileSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/** The invite form: the email typed twice, since the invitation goes to that address. */
export const inviteUserFormSchema = inviteUserSchema
  .extend({ emailConfirm: emailSchema })
  .refine((value) => value.email === value.emailConfirm, {
    path: ["emailConfirm"],
    error: "メールアドレスが一致していません",
  });
export type InviteUserFormInput = z.infer<typeof inviteUserFormSchema>;

/**
 * Edits another user (担当者情報編集): any subset of the name parts, role and permission keys,
 * saved together, and the whole profile when any of it changed. A role or permission change needs
 * `changeRole`, a profile change the `update User` grant; see the user service.
 */
export const updateUserSchema = z.object({
  userId: idSchema,
  ...userNamePatchShape,
  role: roleSchema.optional(),
  permissionKeys: permissionKeysSchema.optional(),
  profile: userProfileSchema.optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * The edit form: it always holds the profile, so a user from before profiles is asked for one; the
 * form sends it only when it changed (`toUpdateInput`).
 */
export const updateUserFormSchema = updateUserSchema.extend({ profile: userProfileSchema });
export type UpdateUserFormInput = z.infer<typeof updateUserFormSchema>;

/** Columns the user list may be sorted by; anything else is rejected, never passed to Prisma. */
export const USER_SORT_FIELDS = ["employeeNumber", "name", "email", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
/** `active` users can sign in; `deactivated` ones are soft-deleted (`deletedAt` set). */
export const USER_STATUSES = ["active", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const listUsersSchema = paginationSchema.extend({
  /** 社員番号 (digits), 氏名, フリガナ or メールアドレス. */
  search: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  status: z.enum(USER_STATUSES).default("active"),
  areas: z.array(sourceAreaSchema).optional(),
  regionCodes: z.array(regionCodeSchema).optional(),
  positions: z.array(positionSchema).optional(),
  sortBy: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDERS).default("desc"),
});
export type ListUsersInput = z.input<typeof listUsersSchema>;
export type ListUsersQuery = z.output<typeof listUsersSchema>;

/** Whether a 社員番号 is free (legacy userNumberExists); `excludeUserId` is the user being edited. */
export const employeeNumberAvailableSchema = z.object({
  employeeNumber: employeeNumberSchema("社員番号"),
  excludeUserId: idSchema.optional(),
});
export type EmployeeNumberAvailableInput = z.output<typeof employeeNumberAvailableSchema>;

/**
 * The users a form may offer as 担当者: with `regionCodes` those covering one of them (the スタッフ
 * form), without every one (the クライアント and 就業先部署 forms, as the legacy).
 */
export const chargerOptionsSchema = z.object({
  regionCodes: regionCodesSchema
    .refine((codes) => codes.length > 0, { error: "地域を選択してください" })
    .optional(),
});
export type ChargerOptionsInput = z.output<typeof chargerOptionsSchema>;

/** The most 担当者 a クライアント or a 就業先部署 takes: far above any real case, it bounds a request. */
export const CHARGERS_MAX = 100;

/** The 担当者 of a クライアント or a 就業先部署: user ids, distinct, at least one. */
export const chargerUserIdsSchema = z
  .array(idSchema)
  .max(CHARGERS_MAX, { error: `${String(CHARGERS_MAX)}件以内で選択してください` })
  .transform((ids) => [...new Set(ids)])
  .refine((ids) => ids.length > 0, { error: "担当者を選択してください" });
