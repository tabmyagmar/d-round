import { createUploadUrlSchema } from "@repo/validation";

import * as attachmentService from "../../modules/attachment/attachment.service";
import { protectedProcedure, requireAbility, router } from "../init";

/** zod input → ability check → service. Files are read through their owner's procedures. */
export const attachmentRouter = router({
  // Not audited (as the legacy generateUploadUrls): the file appears in its owner's change.
  createUploadUrl: protectedProcedure
    .meta({ audit: false })
    .use(requireAbility("create", "Attachment"))
    .input(createUploadUrlSchema)
    .mutation(({ ctx, input }) => attachmentService.createUploadUrl(ctx, input)),
});
