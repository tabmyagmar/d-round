import { z } from "zod";

import { phoneSchema } from "../phone.schema";
import { addressSchema, postCodeSchema } from "../source.schema";
import type { SourceArea } from "../source.schema";
import { createStaffSchema, jobHistorySchema } from "../staff.schema";
import type { EmployeeType, Gender } from "../staff.schema";
import type { Position } from "../user.schema";

import {
  dateCellOf,
  emailListCell,
  integerCell,
  labelCell,
  labelListCell,
  nameListCell,
  optionalTextCell,
  textCell,
} from "./cells";
import { defineCsvType } from "./define";
import type { CsvLookups } from "./define";
import type { CsvColumn } from "./file";
import {
  AREA_BY_LABEL,
  EMPLOYEE_TYPE_BY_LABEL,
  GENDER_BY_LABEL,
  POSITION_BY_LABEL,
} from "./labels";

/**
 * スタッフ CSV (legacy `STAFF_CSV_HEADER_MAP` / `STAFF_CSV_UPDATE_HEADER_MAP` and the templates
 * `CSV スタッフ情報追加.csv` / `更新.csv`). 住所 is the part after the post code's address (番地・建物名),
 * as on the form; the 在籍情報 of a new staff comes from 入社日 / 退職日 / 退職理由, which an update
 * does not carry (its periods stay as they are).
 */
const baseColumns: CsvColumn[] = [
  { key: "employeeType", header: "雇用区分（必須）", aliases: ["雇用区分"], required: true },
  {
    key: "employeeNumber",
    header: "スタッフ番号（必須）",
    aliases: ["スタッフ番号"],
    required: true,
  },
  { key: "lastName", header: "姓（必須）", aliases: ["姓"], required: true },
  { key: "firstName", header: "名（必須）", aliases: ["名"], required: true },
  { key: "lastNameKana", header: "セイ（必須）", aliases: ["セイ"], required: true },
  { key: "firstNameKana", header: "メイ（必須）", aliases: ["メイ"], required: true },
  { key: "areas", header: "エリア（必須）", aliases: ["エリア"], required: true },
  {
    key: "regionCodes",
    header: "地域（必須）",
    aliases: ["地域", "地区（必須）", "地区"],
    required: true,
  },
  { key: "prefectureCodes", header: "都道府県（必須）", aliases: ["都道府県"], required: true },
  {
    key: "chargerEmails",
    header: "担当者メールアドレス（必須）",
    aliases: ["担当者メールアドレス"],
    required: true,
  },
  { key: "branchName", header: "支店名（必須）", aliases: ["支店名"], required: true },
  { key: "position", header: "役職（必須）", aliases: ["役職"], required: true },
  { key: "birthday", header: "生年月日（必須）", aliases: ["生年月日"], required: true },
  { key: "gender", header: "性別（必須）", aliases: ["性別"], required: true },
  { key: "postCode", header: "郵便番号（必須）", aliases: ["郵便番号"], required: true },
  { key: "address1", header: "住所（必須）", aliases: ["住所"], required: true },
  { key: "phoneNumber", header: "電話番号（必須）", aliases: ["電話番号"], required: true },
  { key: "emergencyPhoneNumber", header: "緊急連絡先（電話番号）", aliases: ["緊急連絡先"] },
  { key: "email", header: "メールアドレス" },
];

const jobColumns: CsvColumn[] = [
  { key: "hireDate", header: "入社日（必須）", aliases: ["入社日"], required: true },
  { key: "resignationDate", header: "退職日" },
  { key: "resignationReason", header: "退職理由" },
];

/** A スタッフ row with the form's values; 担当者 as addresses, which the import looks up. */
export type StaffCsvRow = {
  employeeType: EmployeeType;
  employeeNumber: number;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  areas: SourceArea[];
  regionCodes: number[];
  prefectureCodes: number[];
  chargerEmails: string[];
  branchName: string;
  position: Position;
  birthday: string;
  gender: Gender;
  postCode: string;
  address1: string;
  phoneNumber: string;
  emergencyPhoneNumber: string | null;
  email: string | null;
};

/** A new スタッフ's row: its first 在籍情報 too. */
export type StaffCreateCsvRow = StaffCsvRow & {
  hireDate: string;
  resignationDate: string | null;
  resignationReason: string | null;
};

const baseShape = (lookups: CsvLookups) => ({
  employeeType: labelCell(EMPLOYEE_TYPE_BY_LABEL, "雇用区分を選択してください"),
  employeeNumber: integerCell("スタッフ番号", createStaffSchema.shape.employeeNumber),
  lastName: textCell(createStaffSchema.shape.lastName),
  firstName: textCell(createStaffSchema.shape.firstName),
  lastNameKana: textCell(createStaffSchema.shape.lastNameKana),
  firstNameKana: textCell(createStaffSchema.shape.firstNameKana),
  areas: labelListCell(AREA_BY_LABEL, "エリアを選択してください"),
  regionCodes: nameListCell(lookups.regionCodeByName, "地域を選択してください"),
  prefectureCodes: nameListCell(lookups.prefectureCodeByName, "都道府県を選択してください"),
  chargerEmails: emailListCell("担当者を選択してください"),
  branchName: textCell(createStaffSchema.shape.branchName),
  position: labelCell(POSITION_BY_LABEL, "役職を選択してください"),
  birthday: dateCellOf(createStaffSchema.shape.birthday),
  gender: labelCell(GENDER_BY_LABEL, "性別を選択してください"),
  postCode: textCell(postCodeSchema),
  address1: textCell(addressSchema.shape.address1),
  phoneNumber: textCell(phoneSchema),
  emergencyPhoneNumber: optionalTextCell(phoneSchema.nullable()),
  email: optionalTextCell(createStaffSchema.shape.email),
});

/** スタッフを追加: each row creates a スタッフ through the staff form's rules. */
export const staffCreateCsv = defineCsvType<StaffCreateCsvRow>({
  type: "STAFF_CREATE",
  columns: [...baseColumns, ...jobColumns],
  uniqueKeys: ["employeeNumber", "email"],
  rowSchema: (lookups) =>
    z.object({
      ...baseShape(lookups),
      hireDate: dateCellOf(jobHistorySchema.shape.hireDate),
      resignationDate: dateCellOf(jobHistorySchema.shape.resignationDate),
      resignationReason: optionalTextCell(jobHistorySchema.shape.resignationReason),
    }) satisfies z.ZodType<StaffCreateCsvRow>,
});

/** スタッフを更新: a row finds its スタッフ by スタッフ番号 (legacy `staff-csv-update-check`). */
export const staffUpdateCsv = defineCsvType<StaffCsvRow>({
  type: "STAFF_UPDATE",
  columns: baseColumns,
  uniqueKeys: ["employeeNumber", "email"],
  rowSchema: (lookups) => z.object(baseShape(lookups)) satisfies z.ZodType<StaffCsvRow>,
});
