import type {
  CsvImport,
  CsvImportRow,
  CsvImportStatus,
  CsvImportType,
  Prisma,
} from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

export type CreateCsvImportData = {
  type: CsvImportType;
  fileName: string;
  createdById: string;
};

/** One data line as the check stores it. */
export type CsvImportRowData = {
  lineNumber: number;
  data: Prisma.InputJsonValue;
  errors: string[];
};

/** What the check found: the counts, and a finding about the whole file. */
export type CsvImportCheckSummary = {
  totalCount: number;
  validCount: number;
  fileError: string | null;
};

/** What the import did with one confirmed row. */
export type CsvImportRowOutcome =
  { result: "IMPORTED"; entityId: string } | { result: "FAILED"; resultError: string };

/** An import as the history lists it, with who uploaded it (the legacy 担当者情報 column). */
export type CsvImportListItem = CsvImport & { createdBy: { name: string; email: string } };

/**
 * CSV imports and their rows (docs/adr/0013-csv-import.md). Every transition is one conditional
 * update naming the status it expects and answers whether it happened, so a job that runs twice,
 * or a sweeper racing a worker, changes nothing the second time. Which transition runs when is
 * the service's and the job runners' decision.
 */
export const createCsvImportRepository = (db: DbClient) => ({
  create: (data: CreateCsvImportData): Promise<CsvImport> => db.csvImport.create({ data }),

  findById: (id: string): Promise<CsvImport | null> => db.csvImport.findUnique({ where: { id } }),

  /** The imports `where` matches (the service scopes it), newest first. */
  findPage: async (
    params: Partial<PageParams>,
    where: Prisma.CsvImportWhereInput,
  ): Promise<PageResult<CsvImportListItem>> => {
    const page = normalizePage(params);
    const [items, total] = await Promise.all([
      db.csvImport.findMany({
        where,
        include: { createdBy: { select: { name: true, email: true } } },
        ...toSkipTake(page),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.csvImport.count({ where }),
    ]);
    return buildPage(items, total, page);
  },

  /** Every row of the import, in line order (a file holds 150 at most). */
  findRows: (csvImportId: string): Promise<CsvImportRow[]> =>
    db.csvImportRow.findMany({ where: { csvImportId }, orderBy: { lineNumber: "asc" } }),

  /**
   * UPLOADED → CHECKING. A retry of the same check job finds it CHECKING and may run again: the
   * check only reads and replaces the rows. False once the import moved on.
   */
  claimCheck: async (id: string): Promise<boolean> => {
    const { count } = await db.csvImport.updateMany({
      where: { id, status: { in: ["UPLOADED", "CHECKING"] } },
      data: { status: "CHECKING" },
    });
    return count === 1;
  },

  /** The rows the check read replace those of an earlier attempt. */
  replaceRows: async (csvImportId: string, rows: readonly CsvImportRowData[]): Promise<void> => {
    await db.csvImportRow.deleteMany({ where: { csvImportId } });
    await db.csvImportRow.createMany({ data: rows.map((row) => ({ csvImportId, ...row })) });
  },

  /** CHECKING → CHECKED with what the check found; false when the import left CHECKING. */
  markChecked: async (id: string, summary: CsvImportCheckSummary): Promise<boolean> => {
    const { count } = await db.csvImport.updateMany({
      where: { id, status: "CHECKING" },
      data: { status: "CHECKED", ...summary, checkedAt: new Date() },
    });
    return count === 1;
  },

  /** Marks the confirmed lines among the rows without errors; returns how many it marked. */
  selectRows: async (csvImportId: string, lineNumbers: readonly number[]): Promise<number> => {
    const { count } = await db.csvImportRow.updateMany({
      where: { csvImportId, lineNumber: { in: [...lineNumbers] }, errors: { isEmpty: true } },
      data: { selected: true },
    });
    return count;
  },

  /** CHECKED → CONFIRMED, for the uploader only; false otherwise. */
  markConfirmed: async (id: string, createdById: string, selectedCount: number) => {
    const { count } = await db.csvImport.updateMany({
      where: { id, createdById, status: "CHECKED" },
      data: { status: "CONFIRMED", selectedCount, confirmedAt: new Date() },
    });
    return count === 1;
  },

  /** CONFIRMED → IMPORTING; false when another run already took it (an import runs once). */
  claimImport: async (id: string): Promise<boolean> => {
    const { count } = await db.csvImport.updateMany({
      where: { id, status: "CONFIRMED" },
      data: { status: "IMPORTING" },
    });
    return count === 1;
  },

  /** The confirmed rows the import has not handled yet, in line order. */
  findRowsToImport: (csvImportId: string): Promise<CsvImportRow[]> =>
    db.csvImportRow.findMany({
      where: { csvImportId, selected: true, result: null },
      orderBy: { lineNumber: "asc" },
    }),

  recordRowResult: (rowId: string, outcome: CsvImportRowOutcome): Promise<CsvImportRow> =>
    db.csvImportRow.update({ where: { id: rowId }, data: outcome }),

  /** One more confirmed row handled: the dialog's progress and the sweeper's heartbeat. */
  incrementProcessed: (id: string): Promise<CsvImport> =>
    db.csvImport.update({ where: { id }, data: { processedCount: { increment: 1 } } }),

  /** How many rows the import wrote and refused so far. */
  countResults: async (csvImportId: string): Promise<{ imported: number; failed: number }> => {
    const groups = await db.csvImportRow.groupBy({
      by: ["result"],
      where: { csvImportId, result: { not: null } },
      _count: { _all: true },
    });
    const countOf = (result: "IMPORTED" | "FAILED") =>
      groups.find((group) => group.result === result)?._count._all ?? 0;
    return { imported: countOf("IMPORTED"), failed: countOf("FAILED") };
  },

  /** IMPORTING → IMPORTED with the rows' counts; false when the import left IMPORTING. */
  markImported: async (
    id: string,
    counts: { importedCount: number; failedCount: number },
  ): Promise<boolean> => {
    const { count } = await db.csvImport.updateMany({
      where: { id, status: "IMPORTING" },
      data: { status: "IMPORTED", ...counts, importedAt: new Date() },
    });
    return count === 1;
  },

  /** CHECKING or IMPORTING → FAILED with the reason; false when it is no longer in `from`. */
  markFailed: async (
    id: string,
    from: Extract<CsvImportStatus, "CHECKING" | "IMPORTING">,
    lastError: string,
  ): Promise<boolean> => {
    const { count } = await db.csvImport.updateMany({
      where: { id, status: from },
      data: { status: "FAILED", lastError },
    });
    return count === 1;
  },

  /** Imports still in `status` whose last change is older than `before`, oldest first. */
  findStale: (status: CsvImportStatus, before: Date, limit: number): Promise<CsvImport[]> =>
    db.csvImport.findMany({
      where: { status, updatedAt: { lt: before } },
      orderBy: { updatedAt: "asc" },
      take: limit,
    }),
});

export type CsvImportRepository = ReturnType<typeof createCsvImportRepository>;
