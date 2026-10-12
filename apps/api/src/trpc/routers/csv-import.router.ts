import {
  confirmCsvImportSchema,
  createCsvImportSchema,
  csvImportIdSchema,
  listCsvImportsSchema,
} from "@repo/validation";

import * as csvImportService from "../../modules/csv-import/csv-import.service";
import { protectedProcedure, requireAbility, router } from "../init";

/**
 * zod input → ability check → service. Uploading and confirming need catalog 1401
 * (`create SourceCsvHistory`), reading 1402; the service adds the entity's grant and keeps every
 * import its uploader's only.
 */
export const csvImportRouter = router({
  create: protectedProcedure
    .use(requireAbility("create", "SourceCsvHistory"))
    .input(createCsvImportSchema)
    .mutation(({ ctx, input }) => csvImportService.create(ctx, input)),

  confirm: protectedProcedure
    .use(requireAbility("create", "SourceCsvHistory"))
    .input(confirmCsvImportSchema)
    .mutation(({ ctx, input }) => csvImportService.confirm(ctx, input)),

  byId: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(csvImportIdSchema)
    .query(({ ctx, input }) => csvImportService.byId(ctx, input.csvImportId)),

  rows: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(csvImportIdSchema)
    .query(({ ctx, input }) => csvImportService.rows(ctx, input.csvImportId)),

  list: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(listCsvImportsSchema)
    .query(({ ctx, input }) => csvImportService.list(ctx, input)),

  errorCsv: protectedProcedure
    .use(requireAbility("read", "SourceCsvHistory"))
    .input(csvImportIdSchema)
    .query(({ ctx, input }) => csvImportService.errorCsv(ctx, input.csvImportId)),
});
