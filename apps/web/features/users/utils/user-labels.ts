import type { Position, Role, SourceArea, UserStatus } from "@repo/validation";

import { AREA_LABELS } from "@/components/source/source-labels";

/** アカウントタイプ labels, as in the legacy app. */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "スーパーアドミン",
  admin: "アドミン",
  manager: "マネジャー",
  am: "AM",
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

/** 役職 labels, as in the legacy app (SV is "AM"). */
export const POSITION_LABELS: Record<Position, string> = {
  EXECUTIVE: "役員",
  AREA_MANAGER: "エリア責任者",
  DISTRICT_MANAGER: "地区責任者",
  SV: "AM",
  LEADER: "リーダー",
  DISPATCH_COORDINATOR: "派遣コーディネーター",
  FULL_TIME_EMPLOYEE: "正社員",
  AREA_EMPLOYEE: "エリア社員",
  CONTRACT_EMPLOYEE: "契約社員",
  SUBCONTRACT_STAFF: "請負スタッフ",
  DISPATCH_STAFF: "派遣スタッフ",
  STAFF: "スタッフ",
  OTHER: "その他",
};

/** The parts of a 担当者 profile the list and detail show by name. */
type ProfileNames = {
  areas: readonly SourceArea[];
  regions: readonly { region: { name: string } }[];
} | null;

/** エリア of a 担当者 ("東日本、西日本"), or `null` without a profile. */
export const areaNamesOf = (profile: ProfileNames): string | null =>
  profile && profile.areas.length > 0
    ? profile.areas.map((area) => AREA_LABELS[area]).join("、")
    : null;

/** 地域 of a 担当者 by name, or `null` without a profile. */
export const regionNamesOf = (profile: ProfileNames): string | null =>
  profile && profile.regions.length > 0
    ? profile.regions.map((region) => region.region.name).join("、")
    : null;

/** A deactivated user is soft-deleted: `deletedAt` is set. */
export const userStatusOf = (user: { deletedAt: Date | null }): UserStatus =>
  user.deletedAt ? "deactivated" : "active";
