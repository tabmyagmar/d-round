import type { CommentFor, CommentTemplate, Prisma } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

export type CommentTemplateCreate = {
  /** The owner (the signed-in user); the service sets it, never the client. */
  createdBy: string;
  types: CommentFor[];
  short: string;
  content: string;
};

export type CommentTemplateUpdate = Partial<
  Pick<CommentTemplateCreate, "types" | "short" | "content">
>;

/**
 * Pure data access for 定型文. The `where` of a read or a delete is composed by the service (owner
 * scope from the ability, search, menu) and passed through. Templates are hard-deleted (ADR 0006).
 */
export const createCommentTemplateRepository = (db: DbClient) => ({
  findById: (id: string): Promise<CommentTemplate | null> =>
    db.commentTemplate.findUnique({ where: { id } }),

  /** Newest first; `id` breaks ties so pages never overlap. */
  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.CommentTemplateWhereInput = {},
  ): Promise<PageResult<CommentTemplate>> => {
    const page = normalizePage(params);
    const [items, total] = await Promise.all([
      db.commentTemplate.findMany({
        where,
        ...toSkipTake(page),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.commentTemplate.count({ where }),
    ]);
    return buildPage(items, total, page);
  },

  create: (data: CommentTemplateCreate): Promise<CommentTemplate> =>
    db.commentTemplate.create({ data }),

  update: (id: string, data: CommentTemplateUpdate): Promise<CommentTemplate> =>
    db.commentTemplate.update({ where: { id }, data }),

  /** Deletes the rows `where` selects; returns how many there were. */
  deleteMany: async (where: Prisma.CommentTemplateWhereInput): Promise<number> =>
    (await db.commentTemplate.deleteMany({ where })).count,
});

export type CommentTemplateRepository = ReturnType<typeof createCommentTemplateRepository>;
