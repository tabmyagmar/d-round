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
