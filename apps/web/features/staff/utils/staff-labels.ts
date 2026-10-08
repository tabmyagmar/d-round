import type { SelectOption } from "@repo/ui/components/form";
import { EMPLOYEE_TYPES, FAMILY_RELATIONS, GENDERS, STAFF_STATUSES } from "@repo/validation";
import type {
  EmployeeType,
  FamilyRelation,
  Gender,
  StaffMemoType,
  StaffStatus,
} from "@repo/validation";

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

/** 続柄 labels, as in the legacy app. */
export const FAMILY_RELATION_LABELS: Record<FamilyRelation, string> = {
  HUSBAND: "夫",
  WIFE: "妻",
  FATHER: "父",
  MOTHER: "母",
  FATHER_IN_LAW: "義父",
  MOTHER_IN_LAW: "義母",
  GRANDFATHER: "祖父",
  GRANDMOTHER: "祖母",
  ELDEST_SON: "長男",
  SECOND_SON: "次男",
  THIRD_SON: "三男",
  ELDEST_DAUGHTER: "長女",
  SECOND_DAUGHTER: "次女",
  THIRD_DAUGHTER: "三女",
  GRANDCHILD: "孫",
  NEPHEW: "甥",
  NIECE: "姪",
  PARENTAL_UNCLE: "伯父",
  PARENTAL_AUNT: "伯母",
  UNCLE: "叔父",
  AUNT: "叔母",
  GREAT_GRANDFATHER: "曽祖父",
  GREAT_GRANDMOTHER: "曽祖母",
};

export const FAMILY_RELATION_OPTIONS: SelectOption<FamilyRelation>[] = FAMILY_RELATIONS.map(
  (relation) => ({ value: relation, label: FAMILY_RELATION_LABELS[relation] }),
);

/** メモ labels, as in the legacy app: a memo the user added (`CUSTOM`) is just メモ. */
export const STAFF_MEMO_TYPE_LABELS: Record<StaffMemoType, string> = {
  STAFF_MEMO: "スタッフメモ",
  ENTRY_EXIT: "入退社情報",
  ADDRESS_CHANGE: "住所変更",
  INSURANCE: "保険関係",
  OTHER: "その他",
  CUSTOM: "メモ",
};

/** 郵便番号 as the legacy wrote it: seven digits, typed with or without the hyphen, as 〒160-0022. */
export const postCodeLabel = (postCode: string): string => {
  const digits = postCode.replace("-", "");
  return `〒${digits.slice(0, 3)}-${digits.slice(3)}`;
};

/** What the staff form says when another staff holds the スタッフ番号 (legacy wording). */
export const STAFF_NUMBER_TAKEN = "このスタッフ番号は既に使用されています";
