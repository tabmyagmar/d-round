import { z } from "zod";

import { toHalfWidthDigits } from "./common.schema";

/**
 * Reference data: エリア → 地域 (regions) → 都道府県 (prefectures) and the Japan Post post-code
 * master, read by every signed-in user (`source` router, ADR 0005).
 */

/** エリア (legacy EnumArea), in the legacy order: 東日本, 西日本. */
export const SOURCE_AREAS = ["EAST", "WEST"] as const;
export const sourceAreaSchema = z.enum(SOURCE_AREAS);
export type SourceArea = z.infer<typeof sourceAreaSchema>;

/** A region (地域) code: URL parameters and select values arrive as strings. */
export const regionCodeSchema = z.coerce.number().int().min(1);

/** A prefecture (都道府県) code, read like a region code. */
export const prefectureCodeSchema = z.coerce.number().int().min(1);

/** Distinct codes in ascending order (a code twice would break a join table's key). */
/**
 * The most codes one field takes: the master has 47 prefectures and 9 regions, so this only bounds
 * an oversized request.
 */
export const SOURCE_CODES_MAX = 100;

const codesSchema = z
  .array(z.number().int().min(1))
  .max(SOURCE_CODES_MAX, { error: `${String(SOURCE_CODES_MAX)}件以内で選択してください` })
  .transform((codes) => [...new Set(codes)].sort((a, b) => a - b));

/** Region codes as a form or the API sends them (numbers; a URL filter uses `regionCodeSchema`). */
export const regionCodesSchema = codesSchema;

/** Prefecture codes as a form or the API sends them. */
export const prefectureCodesSchema = codesSchema;

/** Distinct areas in the legacy order. */
export const areasSchema = z
  .array(sourceAreaSchema)
  .transform((areas) => SOURCE_AREAS.filter((area) => areas.includes(area)));

/** 郵便番号: "123-4567" or "1234567" (legacy ZipCodeSchema), looked up and stored as 7 digits. */
export const postCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{3}-?\d{4}$/, { error: "正しい郵便番号を入力してください" })
  .transform((value) => value.replace("-", ""));

/** 郵便番号 as typed, with the hyphen after three digits (`1600022` → `160-0022`), as the legacy field. */
export const formatPostCode = (text: string): string => {
  const digits = toHalfWidthDigits(text).replace(/\D/g, "").slice(0, 7);
  return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
};

/** 住所検索: the address parts of one post code. */

export const addressByPostCodeSchema = z.object({ postCode: postCodeSchema });
export type AddressByPostCodeInput = z.input<typeof addressByPostCodeSchema>;

/** 郵便番号 and the typed 住所 (番地・建物名); 都道府県 / 市区町村 / 町域 come from the master. */
export const addressSchema = z.object({
  postCode: postCodeSchema,
  address1: z
    .string()
    .trim()
    .min(1, { error: "住所を入力してください" })
    .max(200, { error: "住所は200文字以内で入力してください" }),
});
export type AddressInput = z.output<typeof addressSchema>;

/**
 * The address as a form edits it (`AddressFields`): the API's fields plus 住所(県名) and
 * 住所(市町村名), which the post-code lookup fills and the form shows; an empty 県名 means the code
 * was not found (the legacy AddressSchema's message). The API never takes them.
 */
export const addressFormSchema = addressSchema.extend({
  pref: z.string().min(1, { error: "郵便番号を入力してください" }),
  cityTown: z.string(),
});
