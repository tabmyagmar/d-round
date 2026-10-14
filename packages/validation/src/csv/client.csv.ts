import { z } from "zod";

import { createClientSchema } from "../client.schema";
import type { ClientOrderType } from "../client.schema";
import { phoneSchema } from "../phone.schema";
import { addressSchema, postCodeSchema } from "../source.schema";
import type { SourceArea } from "../source.schema";

import {
  emailListCell,
  integerCell,
  labelListCell,
  nameListCell,
  optionalTextCell,
  textCell,
} from "./cells";
import { defineCsvType } from "./define";
import type { CsvLookups } from "./define";
import type { CsvColumn } from "./file";
import { AREA_BY_LABEL, ORDER_TYPE_BY_LABEL } from "./labels";

/**
 * クライアント CSV (legacy `CLIENT_CSV_HEADER_MAP`, the templates `CSV クライアント情報追加.csv` /
 * `更新.csv`, which share their columns). 住所 is the part after the post code's address, as on
 * the form; 地区 is the legacy header of the 地域 column.
 */
const columns: CsvColumn[] = [
  {
    key: "number",
    header: "クライアント番号（必須）",
    aliases: ["クライアント番号"],
    required: true,
  },
  { key: "name", header: "クライアント名（必須）", aliases: ["クライアント名"], required: true },
  {
    key: "nameKana",
    header: "クライアント名（カタカナ）（必須）",
    aliases: ["クライアント名（カタカナ）"],
    required: true,
  },
  { key: "areas", header: "エリア（必須）", aliases: ["エリア"], required: true },
  {
    key: "regionCodes",
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
  { key: "phoneNumber", header: "電話番号（必須）", aliases: ["電話番号"], required: true },
  { key: "fax", header: "FAX" },
  { key: "webUrl", header: "URL" },
  { key: "orderTypes", header: "受注区分（必須）", aliases: ["受注区分"], required: true },
];

/** A クライアント row with the form's values; 担当者 as addresses, which the import looks up. */
export type ClientCsvRow = {
  number: number;
  name: string;
  nameKana: string;
  areas: SourceArea[];
  regionCodes: number[];
  chargerEmails: string[];
  postCode: string;
  address1: string;
  phoneNumber: string;
  fax: string | null;
  webUrl: string | null;
  orderTypes: ClientOrderType[];
};

const clientRowSchema = (lookups: CsvLookups) =>
  z.object({
    number: integerCell("クライアント番号", createClientSchema.shape.number),
    name: textCell(createClientSchema.shape.name),
    nameKana: textCell(createClientSchema.shape.nameKana),
    areas: labelListCell(AREA_BY_LABEL, "エリアを選択してください"),
    regionCodes: nameListCell(lookups.regionCodeByName, "地域を選択してください"),
    chargerEmails: emailListCell("担当者を選択してください"),
    postCode: textCell(postCodeSchema),
    address1: textCell(addressSchema.shape.address1),
    phoneNumber: textCell(phoneSchema),
    fax: optionalTextCell(createClientSchema.shape.fax),
    webUrl: optionalTextCell(createClientSchema.shape.webUrl),
    orderTypes: labelListCell(ORDER_TYPE_BY_LABEL, "受注区分を選択してください"),
  }) satisfies z.ZodType<ClientCsvRow>;

/** クライアントを追加: each row creates a クライアント through the client form's rules. */
export const clientCreateCsv = defineCsvType<ClientCsvRow>({
  type: "CLIENT_CREATE",
  columns,
  uniqueKeys: ["number"],
  rowSchema: clientRowSchema,
});

/** クライアントを更新: a row finds its クライアント by クライアント番号 (legacy `client-csv-update-check`). */
export const clientUpdateCsv = defineCsvType<ClientCsvRow>({
  type: "CLIENT_UPDATE",
  columns,
  uniqueKeys: ["number"],
  rowSchema: clientRowSchema,
});
