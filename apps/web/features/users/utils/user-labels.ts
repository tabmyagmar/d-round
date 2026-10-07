import type { Role, UserStatus } from "@repo/validation";

/** アカウントタイプ labels, as in the legacy app (staff is "AM"). */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "スーパーアドミン",
  admin: "アドミン",
  manager: "マネジャー",
  staff: "AM",
};

/** The legacy ステータス labels: 利用中 (can sign in), 停止 (deactivated). */
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "利用中",
  deactivated: "停止",
};

/** The katakana reading "セイ メイ", or `null` for a user from before the name parts. */
export const readingOf = (user: {
  lastNameKana: string | null;
  firstNameKana: string | null;
}): string | null => [user.lastNameKana, user.firstNameKana].filter(Boolean).join(" ") || null;

/** A deactivated user is soft-deleted: `deletedAt` is set. */
export const userStatusOf = (user: { deletedAt: Date | null }): UserStatus =>
  user.deletedAt ? "deactivated" : "active";
