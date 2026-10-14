import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";
import { familyRelationSchema } from "./staff.schema";

/**
 * CSV ダウンロード (docs/adr/0013-csv-import.md): the rows ticked in a list with the columns picked
 * from the type's fields, written by the API as an xlsx and kept for 履歴. The database enum
 * `CsvExportType` matches (the legacy EnumCsvDownloadType without the 申請書, not ported yet).
 */
export const CSV_EXPORT_TYPES = ["USER", "STAFF", "CLIENT", "BRANCH"] as const;
export const csvExportTypeSchema = z.enum(CSV_EXPORT_TYPES);
export type CsvExportType = z.infer<typeof csvExportTypeSchema>;

/** Rows in one download (the legacy `CSV_DOWNLOAD_LIMIT_EXCEEDED`). */
export const CSV_EXPORT_MAX_ROWS = 500;

export const CSV_EXPORT_NO_FIELDS = "ダウンロードする項目を選択してください";
export const CSV_EXPORT_TOO_MANY = `一度にダウンロードできる件数（${String(CSV_EXPORT_MAX_ROWS)}件）を超えています`;

/** A column a download may hold: the key the dialog sends and the header the file shows. */
export type CsvExportField<K extends string = string> = { key: K; header: string };

/*
 * The columns of each type in the file's order, with the legacy headers (d-round-web
 * `csvDownloadFields.ts`, where every one is ticked by default). The dialog sends keys only; the
 * API owns the headers and the cells (the legacy read whatever field path the browser sent).
 */

export const USER_EXPORT_FIELDS = [
  { key: "employeeNumber", header: "社員番号" },
  { key: "lastName", header: "姓" },
  { key: "firstName", header: "名" },
  { key: "lastNameKana", header: "セイ" },
  { key: "firstNameKana", header: "メイ" },
  { key: "areas", header: "エリア" },
  { key: "regions", header: "地区名" },
  { key: "departmentName", header: "部署名" },
  { key: "position", header: "役職" },
  { key: "email", header: "メールアドレス" },
  { key: "retirementDate", header: "退職日" },
  { key: "status", header: "ステータス" },
] as const satisfies readonly CsvExportField[];
export type UserExportField = (typeof USER_EXPORT_FIELDS)[number]["key"];

/** 入社日 / 退職日 / 退職理由 are the latest 在籍情報's. The legacy named 緊急連絡先 電話番号 too. */
export const STAFF_EXPORT_FIELDS = [
  { key: "employeeType", header: "雇用区分" },
  { key: "employeeNumber", header: "スタッフ番号" },
  { key: "lastName", header: "姓" },
  { key: "firstName", header: "名" },
  { key: "lastNameKana", header: "セイ" },
  { key: "firstNameKana", header: "メイ" },
  { key: "areas", header: "エリア" },
  { key: "regions", header: "地域" },
  { key: "prefectures", header: "都道府県" },
  { key: "chargers", header: "担当者名" },
  { key: "branchName", header: "支店名" },
  { key: "position", header: "役職" },
  { key: "birthday", header: "生年月日" },
  { key: "gender", header: "性別" },
  { key: "postCode", header: "郵便番号" },
  { key: "prefCity", header: "住所（県・市）" },
  { key: "address1", header: "住所" },
  { key: "phoneNumber", header: "電話番号" },
  { key: "emergencyPhoneNumber", header: "緊急連絡先（電話番号）" },
  { key: "email", header: "メールアドレス" },
  { key: "hireDate", header: "入社日" },
  { key: "resignationDate", header: "退職日" },
  { key: "resignationReason", header: "退職理由" },
  { key: "status", header: "ステータス" },
] as const satisfies readonly CsvExportField[];
export type StaffExportField = (typeof STAFF_EXPORT_FIELDS)[number]["key"];

export const CLIENT_EXPORT_FIELDS = [
  { key: "number", header: "クライアント番号" },
  { key: "name", header: "クライアント名" },
  { key: "nameKana", header: "クライアント名（カタカナ）" },
  { key: "areas", header: "エリア" },
  { key: "regions", header: "地区名" },
  { key: "chargers", header: "担当者" },
  { key: "postCode", header: "郵便番号" },
  { key: "prefCity", header: "住所（県・市）" },
  { key: "address1", header: "住所" },
  { key: "phoneNumber", header: "電話番号" },
  { key: "fax", header: "FAX" },
  { key: "webUrl", header: "URL" },
  { key: "orderTypes", header: "受注区分" },
  { key: "status", header: "ステータス" },
] as const satisfies readonly CsvExportField[];
export type ClientExportField = (typeof CLIENT_EXPORT_FIELDS)[number]["key"];

/** The sheet always starts with クライアント番号 and クライアント名, which are not picked. */
export const BRANCH_EXPORT_FIELDS = [
  { key: "number", header: "就業先番号" },
  { key: "name", header: "就業先名" },
  { key: "nameKana", header: "就業先名（カタカナ）" },
  { key: "departmentNumber", header: "部署番号" },
  { key: "departmentName", header: "部署名" },
  { key: "departmentNameKana", header: "部署名（カタカナ）" },
  { key: "area", header: "エリア" },
  { key: "region", header: "地区" },
  { key: "chargers", header: "担当者" },
  { key: "departmentFax", header: "FAX" },
  { key: "postCode", header: "郵便番号" },
  { key: "prefCity", header: "住所" },
  { key: "address1", header: "詳細住所" },
  { key: "status", header: "ステータス" },
  { key: "contactLastName", header: "姓" },
  { key: "contactFirstName", header: "名" },
  { key: "contactLastNameKana", header: "セイ" },
  { key: "contactFirstNameKana", header: "メイ" },
  { key: "contactPosition", header: "役職" },
  { key: "contactEmail", header: "メールアドレス" },
] as const satisfies readonly CsvExportField[];
export type BranchExportField = (typeof BRANCH_EXPORT_FIELDS)[number]["key"];

/** The rows ticked in the list: one at least, CSV_EXPORT_MAX_ROWS at most. */
const idsSchema = (entity: string) =>
  z
    .array(idSchema)
    .min(1, { error: `ダウンロードする${entity}を選択してください` })
    .max(CSV_EXPORT_MAX_ROWS, { error: CSV_EXPORT_TOO_MANY });

/** The picked keys of `fields`, each once and in the file's order (the legacy sorted them). */
const pickedSchema = <K extends string>(fields: readonly CsvExportField<K>[], min: number) => {
  const keys = fields.map((field) => field.key);
  return z
    .array(z.enum(keys))
    .min(min, { error: CSV_EXPORT_NO_FIELDS })
    .transform((picked) => keys.filter((key) => picked.includes(key)));
};

/**
 * One download. A スタッフ's adds the 家族情報 sheet for the 続柄 picked; a クライアント's adds the
 * 就業先部署情報 sheet of its branches with the branch columns picked. Neither picked, no sheet.
 */
export const createCsvExportSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("USER"),
    ids: idsSchema("担当者"),
    fields: pickedSchema(USER_EXPORT_FIELDS, 1),
  }),
  z.object({
    type: z.literal("STAFF"),
    ids: idsSchema("スタッフ"),
    fields: pickedSchema(STAFF_EXPORT_FIELDS, 1),
    familyRelations: z.array(familyRelationSchema).default([]),
  }),
  z.object({
    type: z.literal("CLIENT"),
    ids: idsSchema("クライアント"),
    fields: pickedSchema(CLIENT_EXPORT_FIELDS, 1),
    branchFields: pickedSchema(BRANCH_EXPORT_FIELDS, 0).default([]),
  }),
  z.object({
    type: z.literal("BRANCH"),
    ids: idsSchema("就業先部署"),
    fields: pickedSchema(BRANCH_EXPORT_FIELDS, 1),
  }),
]);
export type CreateCsvExportInput = z.infer<typeof createCsvExportSchema>;

export const csvExportIdSchema = z.object({ csvExportId: idSchema });

/** 履歴: one type's downloads of the caller, newest first. */
export const listCsvExportsSchema = paginationSchema.extend({ type: csvExportTypeSchema });
export type ListCsvExportsInput = z.input<typeof listCsvExportsSchema>;
export type ListCsvExportsQuery = z.output<typeof listCsvExportsSchema>;
