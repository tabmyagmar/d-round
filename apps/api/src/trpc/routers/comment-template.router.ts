import {
  createCommentTemplateSchema,
  deleteCommentTemplatesSchema,
  listCommentTemplatesSchema,
  updateCommentTemplateSchema,
} from "@repo/validation";

import * as commentTemplateService from "../../modules/comment-template/comment-template.service";
import { protectedProcedure, requireAbility, router } from "../init";

/**
 * zod input → ability check → service. The owner rule passes every signed-in user here; the
 * service keeps each user to their own templates.
 */
export const commentTemplateRouter = router({
  list: protectedProcedure
    .use(requireAbility("read", "CommentTemplate"))
    .input(listCommentTemplatesSchema)
    .query(({ ctx, input }) => commentTemplateService.list(ctx, input)),

  create: protectedProcedure
    .use(requireAbility("create", "CommentTemplate"))
    .input(createCommentTemplateSchema)
    .mutation(({ ctx, input }) => commentTemplateService.create(ctx, input)),

  update: protectedProcedure
    .use(requireAbility("update", "CommentTemplate"))
    .input(updateCommentTemplateSchema)
    .mutation(({ ctx, input }) => commentTemplateService.update(ctx, input)),

  deleteMany: protectedProcedure
    .use(requireAbility("delete", "CommentTemplate"))
    .input(deleteCommentTemplatesSchema)
    .mutation(({ ctx, input }) => commentTemplateService.removeMany(ctx, input)),
});
