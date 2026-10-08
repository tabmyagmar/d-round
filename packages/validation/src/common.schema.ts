import { z } from "zod";

/** Primary keys are UUID v7 (see packages/database/prisma/schema.prisma). */
export const idSchema = z.uuid();

export const PAGINATION_MAX_PER_PAGE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(PAGINATION_MAX_PER_PAGE).default(20),
});

export type PaginationInput = z.input<typeof paginationSchema>;
export type Pagination = z.output<typeof paginationSchema>;

/** Trimmed text that must not be empty, with the legacy messages, e.g. `requiredText("姓", 80)`. */
export const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label}を入力してください` })
    .max(max, { error: `${label}は${String(max)}文字以内で入力してください` });
