import type { CsvExport, CsvExportType, Prisma } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

export type CreateCsvExportData = {
  type: CsvExportType;
  fileName: string;
  rowCount: number;
  createdById: string;
};

/** A download as the history lists it, with who made it (the legacy 担当者名 / メールアドレス). */
export type CsvExportListItem = CsvExport & { createdBy: { name: string; email: string } };

/** CSV downloads (docs/adr/0013-csv-import.md): a row per file the server wrote. */
export const createCsvExportRepository = (db: DbClient) => ({
  create: (data: CreateCsvExportData): Promise<CsvExport> => db.csvExport.create({ data }),

  findById: (id: string): Promise<CsvExport | null> => db.csvExport.findUnique({ where: { id } }),

  /** The downloads `where` matches (the service scopes it), newest first. */
  findPage: async (
    params: Partial<PageParams>,
    where: Prisma.CsvExportWhereInput,
  ): Promise<PageResult<CsvExportListItem>> => {
    const page = normalizePage(params);
    const [items, total] = await Promise.all([
      db.csvExport.findMany({
        where,
        include: { createdBy: { select: { name: true, email: true } } },
        ...toSkipTake(page),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.csvExport.count({ where }),
    ]);
    return buildPage(items, total, page);
  },
});

export type CsvExportRepository = ReturnType<typeof createCsvExportRepository>;
