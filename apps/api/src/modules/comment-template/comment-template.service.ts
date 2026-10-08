import { createCommentTemplateRepository, isUniqueViolation } from "@repo/database";
import type { CommentTemplate, CommentTemplateUpdate, PageResult, Prisma } from "@repo/database";
import {
  accessibleCommentTemplatesWhere,
  prismaCommentTemplateSubject,
} from "@repo/permissions/server";
import type {
  CreateCommentTemplateInput,
  DeleteCommentTemplatesInput,
  ListCommentTemplatesQuery,
  UpdateCommentTemplateInput,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";

/**
 * 定型文 — personal data (ADR 0006). The router checked the action on the type, which the owner
 * rule allows every signed-in user; this service scopes every read and delete to the rows the
 * ability allows (the caller's own) and checks the row before an update.
 */

const assertMay = (ctx: RequestContext, action: "create" | "read" | "update" | "delete"): void => {
  if (!ctx.ability.can(action, "CommentTemplate")) {
    throw new ForbiddenError(`Not allowed to ${action} comment templates`);
  }
};

/** The unique key `(created_by, short)`: one title per owner. */
const rethrowDuplicateTitle = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new ConflictError("A comment template with this title already exists", {
      cause: error,
    });
  }
  throw error;
};

export const list = async (
  ctx: RequestContext,
  query: ListCommentTemplatesQuery,
): Promise<PageResult<CommentTemplate>> => {
  assertMay(ctx, "read");
  const filters: Prisma.CommentTemplateWhereInput[] = [
    accessibleCommentTemplatesWhere(ctx.ability, "read"),
  ];
  if (query.search) {
    filters.push({
      OR: [
        { short: { contains: query.search, mode: "insensitive" } },
        { content: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.type) {
    filters.push({ types: { has: query.type } });
  }
  return createCommentTemplateRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
  );
};

/** The owner is always the caller, whatever the client sent. */
export const create = async (
  ctx: RequestContext,
  input: CreateCommentTemplateInput,
): Promise<CommentTemplate> => {
  assertMay(ctx, "create");
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  try {
    return await createCommentTemplateRepository(ctx.db).create({
      createdBy: ctx.user.id,
      types: input.types,
      short: input.short,
      content: input.content,
    });
  } catch (error) {
    return rethrowDuplicateTitle(error);
  }
};

export const update = async (
  ctx: RequestContext,
  { commentTemplateId, types, short, content }: UpdateCommentTemplateInput,
): Promise<CommentTemplate> => {
  const templates = createCommentTemplateRepository(ctx.db);
  const template = await templates.findById(commentTemplateId);
  if (!template) {
    throw new NotFoundError("CommentTemplate", commentTemplateId);
  }
  if (!ctx.ability.can("update", prismaCommentTemplateSubject(template))) {
    throw new ForbiddenError("Not allowed to update this comment template");
  }
  const data: CommentTemplateUpdate = {
    ...(types ? { types } : {}),
    ...(short === undefined ? {} : { short }),
    ...(content === undefined ? {} : { content }),
  };
  try {
    return await templates.update(template.id, data);
  } catch (error) {
    return rethrowDuplicateTitle(error);
  }
};

/** Deletes those of the ids the caller owns; none of them → not found, as the legacy answered. */
export const removeMany = async (
  ctx: RequestContext,
  { commentTemplateIds }: DeleteCommentTemplatesInput,
): Promise<{ deleted: number }> => {
  assertMay(ctx, "delete");
  const deleted = await createCommentTemplateRepository(ctx.db).deleteMany({
    AND: [
      accessibleCommentTemplatesWhere(ctx.ability, "delete"),
      { id: { in: commentTemplateIds } },
    ],
  });
  if (deleted === 0) {
    throw new NotFoundError("CommentTemplate");
  }
  return { deleted };
};
