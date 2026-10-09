import { createUploadUrlSchema } from "@repo/validation";

import * as attachmentService from "../../modules/attachment/attachment.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Files are read through their owner's procedures. */
export const attachmentRouter = router({
  createUploadUrl: protectedProcedure
    .use(requireAbility("create", "Attachment"))
    .input(createUploadUrlSchema)
    .mutation(({ ctx, input }) => attachmentService.createUploadUrl(ctx, input)),
});
