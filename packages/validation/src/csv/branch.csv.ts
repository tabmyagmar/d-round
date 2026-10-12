import { z } from "zod";

import { createBranchSchema } from "../branch.schema";
import { createClientSchema } from "../client.schema";
import { addressSchema, postCodeSchema } from "../source.schema";
import type { SourceArea } from "../source.schema";
import type { Position } from "../user.schema";

import {
  emailListCell,
  integerCell,
  labelCell,
  nameCell,
  optionalTextCell,
  textCell,
} from "./cells";
import { defineCsvType } from "./define";
import type { CsvLookups } from "./define";
import type { CsvColumn } from "./file";
import { AREA_BY_LABEL, POSITION_BY_LABEL } from "./labels";

/**
 * 就業先部署 CSV (legacy `BRANCH_CSV_HEADER_MAP` and the template `CSV 就業先部署情報追加.csv`; the
 * legacy had no update template, the update uses the same columns). A row names its クライアント by
 * クライアント番号; one エリア and one 地域 (地区, the legacy header), as on the form; 姓 … メールアドレス
 * are the 連絡担当者.
 */
const columns: CsvColumn[] = [
  {
    key: "clientNumber",
    header: "クライアント番号（必須）",
    aliases: ["クライアント番号"],
    required: true,
  },
  { key: "number", header: "就業先番号（必須）", aliases: ["就業先番号"], required: true },
  { key: "name", header: "就業先名（必須）", aliases: ["就業先名"], required: true },
  {
    key: "nameKana",
    header: "就業先名（カタカナ）（必須）",
    aliases: ["就業先名（カタカナ）"],
    required: true,
  },
  { key: "departmentNumber", header: "部署番号（必須）", aliases: ["部署番号"], required: true },
  { key: "departmentName", header: "部署名（必須）", aliases: ["部署名"], required: true },
  {
    key: "departmentNameKana",
    header: "部署名（カタカナ）（必須）",
    aliases: ["部署名（カタカナ）"],
    required: true,
  },
  { key: "area", header: "エリア（必須）", aliases: ["エリア"], required: true },
  {
    key: "regionCode",
    header: "地区（必須）",
    aliases: ["地区", "地域（必須）", "地域"],
    required: true,
  },
  {
    key: "chargerEmails",
    header: "担当者メールアドレス（必須）",
    aliases: ["担当者メールアドレス"],
    required: true,
  },
  { key: "postCode", header: "郵便番号（必須）", aliases: ["郵便番号"], required: true },
  { key: "address1", header: "住所（必須）", aliases: ["住所"], required: true },
  { key: "departmentFax", header: "FAX" },
  { key: "contactLastName", header: "姓（必須）", aliases: ["姓"], required: true },
  { key: "contactFirstName", header: "名（必須）", aliases: ["名"], required: true },
  { key: "contactLastNameKana", header: "セイ（必須）", aliases: ["セイ"], required: true },
  { key: "contactFirstNameKana", header: "メイ（必須）", aliases: ["メイ"], required: true },
  { key: "contactPosition", header: "役職（必須）", aliases: ["役職"], required: true },
  {
    key: "contactEmail",
    header: "メールアドレス（必須）",
    aliases: ["メールアドレス"],
    required: true,
  },
];

/** A 就業先部署 row with the form's values; its クライアント and 担当者 as the import looks them up. */
export type BranchCsvRow = {
  clientNumber: number;
  number: number;
  name: string;
  nameKana: string;
  departmentNumber: number;
  departmentName: string;
  departmentNameKana: string;
  area: SourceArea;
  regionCode: number;
  chargerEmails: string[];
  postCode: string;
  address1: string;
  departmentFax: string | null;
  contactLastName: string;
  contactFirstName: string;
  contactLastNameKana: string;
  contactFirstNameKana: string;
  contactPosition: Position;
  contactEmail: string;
};

const shape = createBranchSchema.shape;

const branchRowSchema = (lookups: CsvLookups) =>
  z.object({
    clientNumber: integerCell("クライアント番号", createClientSchema.shape.number),
    number: integerCell("就業先番号", shape.number),
    name: textCell(shape.name),
    nameKana: textCell(shape.nameKana),
    departmentNumber: integerCell("部署番号", shape.departmentNumber),
    departmentName: textCell(shape.departmentName),
    departmentNameKana: textCell(shape.departmentNameKana),
    area: labelCell(AREA_BY_LABEL, "エリアを選択してください"),
    regionCode: nameCell(lookups.regionCodeByName, "地域を選択してください"),
    chargerEmails: emailListCell("担当者を選択してください"),
    postCode: textCell(postCodeSchema),
    address1: textCell(addressSchema.shape.address1),
    departmentFax: optionalTextCell(shape.departmentFax),
    contactLastName: textCell(shape.contactLastName),
    contactFirstName: textCell(shape.contactFirstName),
    contactLastNameKana: textCell(shape.contactLastNameKana),
    contactFirstNameKana: textCell(shape.contactFirstNameKana),
    contactPosition: labelCell(POSITION_BY_LABEL, "役職を選択してください"),
    contactEmail: textCell(shape.contactEmail),
  }) satisfies z.ZodType<BranchCsvRow>;

/** 就業先部署を追加: each row creates a 就業先部署 of an existing クライアント. */
export const branchCreateCsv = defineCsvType<BranchCsvRow>({
  type: "BRANCH_CREATE",
  columns,
  uniqueKeys: [["clientNumber", "number"]],
  rowSchema: branchRowSchema,
});

/** 就業先部署を更新: a row finds its 就業先部署 by クライアント番号 and 就業先番号. */
export const branchUpdateCsv = defineCsvType<BranchCsvRow>({
  type: "BRANCH_UPDATE",
  columns,
  uniqueKeys: [["clientNumber", "number"]],
  rowSchema: branchRowSchema,
});
