import { z } from "zod";

import { dayjs, ISO_DAY, todayIsoDay } from "@repo/dayjs";

import { idSchema, paginationSchema, requiredText } from "./common.schema";
import { phoneSchema } from "./phone.schema";
import {
  addressFormSchema,
  addressSchema,
  areasSchema,
  prefectureCodeSchema,
  prefectureCodesSchema,
  regionCodeSchema,
  regionCodesSchema,
  sourceAreaSchema,
} from "./source.schema";
import {
  employeeNumberSchema,
  KATAKANA_PATTERN,
  positionSchema,
  SORT_ORDERS,
  userNameSchema,
} from "./user.schema";

/** スタッフ (ADR 0008): the legacy staff form's fields and messages, shared by the API and the form. */

/** 雇用区分 (legacy EnumEmployeeType without USER), in the legacy order. */
export const EMPLOYEE_TYPES = ["EXECUTIVE", "FULL_TIME", "CONTRACT", "PART_TIME", "OTHER"] as const;
export const employeeTypeSchema = z.enum(EMPLOYEE_TYPES, { error: "雇用区分を選択してください" });
export type EmployeeType = z.infer<typeof employeeTypeSchema>;

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const genderSchema = z.enum(GENDERS, { error: "性別を選択してください" });
export type Gender = z.infer<typeof genderSchema>;

/** 利用中 / 保留 / 停止. スタッフ削除 is allowed for a 停止 staff only. */
export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export const staffStatusSchema = z.enum(STAFF_STATUSES);
export type StaffStatus = z.infer<typeof staffStatusSchema>;

/** 続柄 (legacy EnumFamilyRelation), in the legacy order. */
export const FAMILY_RELATIONS = [
  "HUSBAND",
  "WIFE",
  "FATHER",
  "MOTHER",
  "FATHER_IN_LAW",
  "MOTHER_IN_LAW",
  "GRANDFATHER",
  "GRANDMOTHER",
  "ELDEST_SON",
  "SECOND_SON",
  "THIRD_SON",
  "ELDEST_DAUGHTER",
  "SECOND_DAUGHTER",
  "THIRD_DAUGHTER",
  "GRANDCHILD",
  "NEPHEW",
  "NIECE",
  "PARENTAL_UNCLE",
  "PARENTAL_AUNT",
  "UNCLE",
  "AUNT",
  "GREAT_GRANDFATHER",
  "GREAT_GRANDMOTHER",
] as const;
export const familyRelationSchema = z.enum(FAMILY_RELATIONS);
export type FamilyRelation = z.infer<typeof familyRelationSchema>;

export const STAFF_MEMO_TYPES = [
  "STAFF_MEMO",
  "ENTRY_EXIT",
  "ADDRESS_CHANGE",
  "INSURANCE",
  "OTHER",
  "CUSTOM",
] as const;
export const staffMemoTypeSchema = z.enum(STAFF_MEMO_TYPES);
export type StaffMemoType = z.infer<typeof staffMemoTypeSchema>;

/** The memos the form always shows, in the legacy order; `CUSTOM` ones are added by the user. */
export const FIXED_MEMO_TYPES = [
  "STAFF_MEMO",
  "ENTRY_EXIT",
  "ADDRESS_CHANGE",
  "INSURANCE",
  "OTHER",
] as const satisfies readonly StaffMemoType[];

/** Staff in one delete (the legacy limit). */
export const STAFF_DELETE_MAX = 50;

/**
 * The most rows one list of the staff form takes (在籍情報, 家族情報, メモ, 担当者): far above any
 * real staff, it bounds an oversized request; the form's add buttons stop there.
 */
export const STAFF_LIST_MAX = 100;

const LIST_TOO_LONG = `${String(STAFF_LIST_MAX)}件以内で入力してください`;

/** The youngest a スタッフ may be (legacy AgeSchema(16)). */
export const STAFF_MIN_AGE = 16;

/** Whole years from a `yyyy-MM-dd` birthday to `today` (年齢, beside 生年月日), today in Japan. */
export const ageOf = (birthday: string, today: string = todayIsoDay()): number =>
  dayjs(today, ISO_DAY).diff(dayjs(birthday, ISO_DAY), "year");

const DATE_REQUIRED = "日付は必須です";
const DATE_FORMAT = "日付の形式が正しくありません";

/** A `yyyy-MM-dd` date (DateField). */
const isoDate = (required = DATE_REQUIRED) =>
  z.iso.date({ error: (issue) => (issue.input ? DATE_FORMAT : required) });

/** An optional katakana reading (a family member's), `null` when empty. */
const optionalKanaSchema = z
  .string()
  .trim()
  .max(80, { error: "80文字以内で入力してください" })
  .regex(KATAKANA_PATTERN, { error: "全角カタカナで入力してください" })
  .nullable();

/** 在籍情報: one employment period. */
export const jobHistorySchema = z.object({
  hireDate: isoDate(),
  resignationDate: isoDate().nullable(),
  resignationReason: z
    .string()
    .trim()
    .max(1000, { error: "退職理由は1000文字以内で入力してください" })
    .nullable(),
});

/** 家族情報: one family member; 姓 / 名 required, the rest optional. */
export const familyMemberSchema = z.object({
  lastName: requiredText("姓", 80),
  firstName: requiredText("名", 80),
  lastNameKana: optionalKanaSchema,
  firstNameKana: optionalKanaSchema,
  relation: familyRelationSchema.nullable(),
  birthday: isoDate().nullable(),
});

/** メモ: the form sends the fixed slots with empty text too; the API stores only text. */
export const staffMemoSchema = z.object({
  memoType: staffMemoTypeSchema,
  content: z.string().max(2000, { error: "メモは2000文字以内で入力してください" }),
});

/** スタッフ追加: every field of the legacy form but the file upload (its own ticket). */
export const createStaffSchema = z.object({
  employeeType: employeeTypeSchema,
  employeeNumber: employeeNumberSchema("スタッフ番号"),
  ...userNameSchema.shape,
  gender: genderSchema,
  birthday: isoDate("生年月日を入力してください").refine(
    (birthday) => ageOf(birthday) >= STAFF_MIN_AGE,
    { error: `${String(STAFF_MIN_AGE)}歳以上である必要があります。` },
  ),
  position: positionSchema,
  branchName: requiredText("支店名", 100),
  email: z
    .email({ error: "正しいメールアドレスを入力してください" })
    .max(255, { error: "メールアドレスは255文字以内で入力してください" })
    .nullable(),
  phoneNumber: phoneSchema,
  emergencyPhoneNumber: phoneSchema.nullable(),
  areas: areasSchema.refine((areas) => areas.length > 0, { error: "エリアを選択してください" }),
  regionCodes: regionCodesSchema.refine((codes) => codes.length > 0, {
    error: "地域を選択してください",
  }),
  prefectureCodes: prefectureCodesSchema.refine((codes) => codes.length > 0, {
    error: "都道府県を選択してください",
  }),
  /** 担当者: user ids, distinct. */
  chargerUserIds: z
    .array(idSchema)
    .max(STAFF_LIST_MAX, { error: LIST_TOO_LONG })
    .transform((ids) => [...new Set(ids)])
    .refine((ids) => ids.length > 0, { error: "担当者を選択してください" }),
  address: addressSchema,
  jobHistories: z.array(jobHistorySchema).max(STAFF_LIST_MAX, { error: LIST_TOO_LONG }),
  familyMembers: z.array(familyMemberSchema).max(STAFF_LIST_MAX, { error: LIST_TOO_LONG }),
  memos: z.array(staffMemoSchema).max(STAFF_LIST_MAX, { error: LIST_TOO_LONG }),
});
export type CreateStaffInput = z.output<typeof createStaffSchema>;

/** The staff form (create and edit): the API's fields with the address as `AddressFields` edits it. */
export const staffFormSchema = createStaffSchema.extend({ address: addressFormSchema });
export type StaffFormValues = z.input<typeof staffFormSchema>;

/** スタッフ情報編集: the whole form again (the lists are replaced, ADR 0008). */
export const updateStaffSchema = createStaffSchema.extend({ staffId: idSchema });
export type UpdateStaffInput = z.output<typeof updateStaffSchema>;

export const staffIdSchema = z.object({ staffId: idSchema });

export const changeStaffStatusSchema = z.object({ staffId: idSchema, status: staffStatusSchema });
export type ChangeStaffStatusInput = z.output<typeof changeStaffStatusSchema>;

/** スタッフ削除: one row or the selection, 停止 staff only. */
export const deleteStaffsSchema = z.object({
  staffIds: z.array(idSchema).min(1).max(STAFF_DELETE_MAX),
});
export type DeleteStaffsInput = z.output<typeof deleteStaffsSchema>;

/** Whether a スタッフ番号 is free among non-deleted staff; `excludeStaffId` is the one edited. */
export const staffNumberAvailableSchema = z.object({
  employeeNumber: employeeNumberSchema("スタッフ番号"),
  excludeStaffId: idSchema.optional(),
});
export type StaffNumberAvailableInput = z.output<typeof staffNumberAvailableSchema>;

/** Columns the staff list may be sorted by. */
export const STAFF_SORT_FIELDS = ["employeeNumber", "name", "createdAt"] as const;
export type StaffSortField = (typeof STAFF_SORT_FIELDS)[number];

/** The list: without `statuses`, every staff but the 停止 ones (legacy `status not DELETE`). */
export const listStaffsSchema = paginationSchema.extend({
  /** スタッフ番号 (digits), 氏名 or フリガナ. */
  search: z.string().trim().min(1).max(100).optional(),
  statuses: z.array(staffStatusSchema).optional(),
  genders: z.array(genderSchema).optional(),
  areas: z.array(sourceAreaSchema).optional(),
  regionCodes: z.array(regionCodeSchema).optional(),
  prefectureCodes: z.array(prefectureCodeSchema).optional(),
  employeeTypes: z.array(employeeTypeSchema).optional(),
  sortBy: z.enum(STAFF_SORT_FIELDS).default("employeeNumber"),
  sortOrder: z.enum(SORT_ORDERS).default("asc"),
});
export type ListStaffsInput = z.input<typeof listStaffsSchema>;
export type ListStaffsQuery = z.output<typeof listStaffsSchema>;
