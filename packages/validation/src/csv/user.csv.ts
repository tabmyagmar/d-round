import { z } from "zod";

import type { SourceArea } from "../source.schema";
import { emailSchema, userNameSchema, userProfileSchema } from "../user.schema";
import type { Position, Role } from "../user.schema";

import {
  dateCell,
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
import { AREA_BY_LABEL, POSITION_BY_LABEL, ROLE_BY_LABEL } from "./labels";

/**
 * 担当者 CSV (legacy `USER_CSV_HEADER_MAP` and its template `CSV 担当者情報追加.csv`). The legacy
 * left 社員番号 optional and numbered blanks itself; the form requires it, so the CSV does too
 * (ADR 0013). 地区 is the legacy header of the 地域 column.
 */
const columns = (emailRequired: boolean): CsvColumn[] => [
  { key: "employeeNumber", header: "社員番号（必須）", aliases: ["社員番号"], required: true },
  { key: "lastName", header: "姓（必須）", aliases: ["姓"], required: true },
  { key: "firstName", header: "名（必須）", aliases: ["名"], required: true },
  { key: "lastNameKana", header: "セイ（必須）", aliases: ["セイ"], required: true },
  { key: "firstNameKana", header: "メイ（必須）", aliases: ["メイ"], required: true },
  { key: "areas", header: "エリア（必須）", aliases: ["エリア"], required: true },
  {
    key: "regionCodes",
    header: "地区（必須）",
    aliases: ["地区", "地域（必須）", "地域"],
    required: true,
  },
  { key: "departmentName", header: "部署名（必須）", aliases: ["部署名"], required: true },
  { key: "position", header: "役職（必須）", aliases: ["役職"], required: true },
  emailRequired
    ? {
        key: "email",
        header: "メールアドレス（必須）",
        aliases: ["メールアドレス"],
        required: true,
      }
    : { key: "email", header: "メールアドレス", aliases: ["メールアドレス（必須）"] },
  {
    key: "role",
    header: "アカウントタイプ（必須）",
    aliases: ["アカウントタイプ"],
    required: true,
  },
  { key: "retirementDate", header: "退職日" },
];

/** A 担当者 row with the form's values: codes, region codes, an ISO 退職日. */
export type UserCsvRow = {
  employeeNumber: number;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  areas: SourceArea[];
  regionCodes: number[];
  departmentName: string;
  position: Position;
  /** Null in an update without the column's value: the address is not changed. */
  email: string | null;
  role: Role;
  retirementDate: string | null;
};

const userRowSchema = (lookups: CsvLookups, email: z.ZodType<string | null>) =>
  z.object({
    employeeNumber: integerCell("社員番号", userProfileSchema.shape.employeeNumber),
    lastName: textCell(userNameSchema.shape.lastName),
    firstName: textCell(userNameSchema.shape.firstName),
    lastNameKana: textCell(userNameSchema.shape.lastNameKana),
    firstNameKana: textCell(userNameSchema.shape.firstNameKana),
    areas: labelListCell(AREA_BY_LABEL, "エリアを選択してください"),
    regionCodes: nameListCell(lookups.regionCodeByName, "地域を選択してください"),
    departmentName: textCell(userProfileSchema.shape.departmentName),
    position: labelCell(POSITION_BY_LABEL, "役職を選択してください"),
    email,
    role: labelCell(ROLE_BY_LABEL, "アカウントタイプを選択してください"),
    retirementDate: dateCell(),
  }) satisfies z.ZodType<UserCsvRow>;

/** 担当者を追加: each row invites a user (the invitation mail goes out, as 担当者追加). */
export const userCreateCsv = defineCsvType<UserCsvRow>({
  type: "USER_CREATE",
  columns: columns(true),
  uniqueKeys: ["email", "employeeNumber"],
  rowSchema: (lookups) => userRowSchema(lookups, textCell(emailSchema)),
});

/**
 * 担当者を更新: a row finds its 担当者 by 社員番号 (legacy `user-csv-update-check`). The address
 * cannot change here, as on the edit screen: a different one is refused, an empty one ignored.
 */
export const userUpdateCsv = defineCsvType<UserCsvRow>({
  type: "USER_UPDATE",
  columns: columns(false),
  uniqueKeys: ["email", "employeeNumber"],
  rowSchema: (lookups) => userRowSchema(lookups, optionalTextCell(emailSchema.nullable())),
});
