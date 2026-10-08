import { z } from "zod";

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

/** 郵便番号: "123-4567" or "1234567" (legacy ZipCodeSchema), looked up and stored as 7 digits. */
export const postCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{3}-?\d{4}$/, { error: "正しい郵便番号を入力してください" })
  .transform((value) => value.replace("-", ""));

/** 住所検索: the address parts of one post code. */
export const addressByPostCodeSchema = z.object({ postCode: postCodeSchema });
export type AddressByPostCodeInput = z.input<typeof addressByPostCodeSchema>;
