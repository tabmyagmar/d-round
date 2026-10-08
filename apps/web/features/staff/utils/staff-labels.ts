import type { SelectOption } from "@repo/ui/components/form";
import { EMPLOYEE_TYPES, GENDERS, STAFF_STATUSES } from "@repo/validation";
import type { EmployeeType, Gender, StaffStatus } from "@repo/validation";

/** The legacy ステータス labels (EnumGeneralStatus): 停止 was `DELETE`. */
export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  ACTIVE: "利用中",
  INACTIVE: "保留",
  SUSPENDED: "停止",
};

export const STAFF_STATUS_OPTIONS: SelectOption<StaffStatus>[] = STAFF_STATUSES.map((status) => ({
  value: status,
  label: STAFF_STATUS_LABELS[status],
}));

/** 性別 labels, as in the legacy app. */
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "男性",
  FEMALE: "女性",
  OTHER: "その他",
};

export const GENDER_OPTIONS: SelectOption<Gender>[] = GENDERS.map((gender) => ({
  value: gender,
  label: GENDER_LABELS[gender],
}));

/** 雇用区分 labels, as in the legacy app (without its 担当者 value). */
export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  EXECUTIVE: "役員",
  FULL_TIME: "正社員",
  CONTRACT: "契約社員",
  PART_TIME: "アルバイト",
  OTHER: "その他",
};

export const EMPLOYEE_TYPE_OPTIONS: SelectOption<EmployeeType>[] = EMPLOYEE_TYPES.map((type) => ({
  value: type,
  label: EMPLOYEE_TYPE_LABELS[type],
}));

/** スタッフ名 "姓 名", as the legacy list wrote it. */
export const staffNameOf = (staff: { lastName: string; firstName: string }): string =>
  `${staff.lastName} ${staff.firstName}`;

/** The katakana reading "セイ メイ". */
export const staffReadingOf = (staff: { lastNameKana: string; firstNameKana: string }): string =>
  `${staff.lastNameKana} ${staff.firstNameKana}`;
