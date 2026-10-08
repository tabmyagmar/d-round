import { z } from "zod";

import { idSchema, paginationSchema } from "./common.schema";

/** The menus a 定型文 is offered in (legacy `EnumCommentFor`), in the legacy order. */
export const COMMENT_FOR = ["WORKFLOW", "APPLICATION", "CLIENT", "STAFF"] as const;
export const commentForSchema = z.enum(COMMENT_FOR);
export type CommentFor = z.infer<typeof commentForSchema>;

export const COMMENT_TEMPLATE_SHORT_MAX = 100;
export const COMMENT_TEMPLATE_CONTENT_MAX = 1000;
/** Ids in one delete (the legacy limit; a page lists 20). */
export const COMMENT_TEMPLATES_DELETE_MAX = 50;

const TYPES_REQUIRED = "使用先メニューを選択してください";

/** One or more menus; duplicates are dropped and the order follows `COMMENT_FOR`. */
const typesSchema = z
  .array(commentForSchema, { error: TYPES_REQUIRED })
  .min(1, { error: TYPES_REQUIRED })
  .transform((types) => COMMENT_FOR.filter((type) => types.includes(type)));

/** タイトル — unique per owner, so surrounding spaces are not part of it. */
const shortSchema = z
  .string()
  .trim()
  .min(1, { error: "タイトルを入力してください" })
  .max(COMMENT_TEMPLATE_SHORT_MAX, {
    error: `タイトルは${String(COMMENT_TEMPLATE_SHORT_MAX)}文字以内にしてください`,
  });

/** テキスト — pasted as written, line breaks and spaces included. */
const contentSchema = z
  .string()
  .min(1, { error: "テキスト内容を入力してください" })
  .max(COMMENT_TEMPLATE_CONTENT_MAX, {
    error: `テキスト内容は${String(COMMENT_TEMPLATE_CONTENT_MAX)}文字以内にしてください`,
  });

/** テンプレート作成; the owner is always the caller (the API sets it). */
export const createCommentTemplateSchema = z.object({
  types: typesSchema,
  short: shortSchema,
  content: contentSchema,
});
export type CreateCommentTemplateFormValues = z.input<typeof createCommentTemplateSchema>;
export type CreateCommentTemplateInput = z.output<typeof createCommentTemplateSchema>;

/** テンプレート編集: any subset of the fields; the client sends only what changed. */
export const updateCommentTemplateSchema = z.object({
  commentTemplateId: idSchema,
  types: typesSchema.optional(),
  short: shortSchema.optional(),
  content: contentSchema.optional(),
});
export type UpdateCommentTemplateInput = z.output<typeof updateCommentTemplateSchema>;

/** 定型文削除: one row or the selection. */
export const deleteCommentTemplatesSchema = z.object({
  commentTemplateIds: z.array(idSchema).min(1).max(COMMENT_TEMPLATES_DELETE_MAX),
});
export type DeleteCommentTemplatesInput = z.output<typeof deleteCommentTemplatesSchema>;

/** The caller's templates: search over title and text, `type` for one menu (the picker). */
export const listCommentTemplatesSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  type: commentForSchema.optional(),
});
export type ListCommentTemplatesInput = z.input<typeof listCommentTemplatesSchema>;
export type ListCommentTemplatesQuery = z.output<typeof listCommentTemplatesSchema>;
