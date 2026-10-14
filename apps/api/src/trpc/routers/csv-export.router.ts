import { createCsvExportSchema, csvExportIdSchema, listCsvExportsSchema } from "@repo/validation";

import * as csvExportService from "../../modules/csv-export/csv-export.service";
import { protectedProcedure, requireAbility, router } from "../init";

/**
 * zod input → ability check → service. Every procedure needs catalog 1402 (`read SourceCsvHistory`,
 * CSVダウンロード); the service adds the entity's read grant and keeps every download its maker's.
 */
export const csvExportRouter = router({
  create: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(createCsvExportSchema)
    .mutation(({ ctx, input }) => csvExportService.create(ctx, input)),

  list: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(listCsvExportsSchema)
    .query(({ ctx, input }) => csvExportService.list(ctx, input)),

  downloadUrl: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(csvExportIdSchema)
    .query(({ ctx, input }) => csvExportService.downloadUrl(ctx, input.csvExportId)),
});
