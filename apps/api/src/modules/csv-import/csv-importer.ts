import { createSourceRepository } from "@repo/database";
import type { DbClient } from "@repo/database";
import { z } from "@repo/validation";
import { checkCsvLines } from "@repo/validation/csv";
import type { CsvCells, CsvLookups, CsvTypeDefinition, ParsedCsvLine } from "@repo/validation/csv";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, ValidationError, isDomainError } from "../../core/errors";
import type { DomainErrorCode } from "../../core/errors";

/**
 * What one CSV type adds to the shared definition (docs/adr/0013-csv-import.md): the database
 * checks the browser cannot run, and the write of one row through the entity's own service, so a
 * CSV row meets exactly the rules of the form.
 */
export type CsvImporter<TRow> = {
  definition: CsvTypeDefinition<TRow>;
  /**
   * The database checks of the rows that passed the format check, all at once: the errors by line
   * number (already registered, a missing update target, a role the uploader may not give).
   */
  check: (
    ctx: RequestContext,
    rows: readonly { lineNumber: number; row: TRow }[],
  ) => Promise<ReadonlyMap<number, readonly string[]>>;
  /** Writes one confirmed row; returns the id of the user, staff, client or branch written. */
  importRow: (ctx: RequestContext, row: TRow) => Promise<string>;
};

/** A line after the whole check, as the import stores it. */
export type CheckedCsvRow = { lineNumber: number; cells: CsvCells; errors: string[] };

/** What the job runners need of a CSV type, with its row type kept inside. */
export type CsvTypeRunner = {
  definition: CsvTypeDefinition<unknown>;
  /** Format, in-file duplicates, then the database checks of the rows still valid. */
  check: (
    ctx: RequestContext,
    lines: readonly ParsedCsvLine[],
    lookups: CsvLookups,
  ) => Promise<CheckedCsvRow[]>;
  /** Reads one confirmed row again and writes it; a row that no longer reads is refused. */
  importLine: (ctx: RequestContext, line: ParsedCsvLine, lookups: CsvLookups) => Promise<string>;
};

export const csvTypeRunner = <TRow>(importer: CsvImporter<TRow>): CsvTypeRunner => ({
  definition: importer.definition,

  check: async (ctx, lines, lookups) => {
    const checked = checkCsvLines(importer.definition, lines, lookups);
    const valid = checked.flatMap((line) =>
      line.row === null ? [] : [{ lineNumber: line.lineNumber, row: line.row }],
    );
    const found = valid.length > 0 ? await importer.check(ctx, valid) : new Map<number, string[]>();
    return checked.map((line) => ({
      lineNumber: line.lineNumber,
      cells: line.cells,
      errors: [...line.errors, ...(found.get(line.lineNumber) ?? [])],
    }));
  },

  importLine: async (ctx, line, lookups) => {
    // Reference data may have changed since the check: the row is read again before it is written.
    const [checked] = checkCsvLines(importer.definition, [line], lookups);
    if (!checked?.row) {
      throw new ValidationError(checked?.errors.join("; ") ?? "行を読み取れませんでした");
    }
    return importer.importRow(ctx, checked.row);
  },
});

/** The database checks' errors, collected by line number. */
export const errorsByLine = () => {
  const errors = new Map<number, string[]>();
  return {
    errors,
    add: (lineNumber: number, message: string) => {
      errors.set(lineNumber, [...(errors.get(lineNumber) ?? []), message]);
    },
  };
};

/** The uploader the import acts for (a job context always has one). */
export const uploaderOf = (ctx: RequestContext) => {
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  return ctx.user;
};

/** Japanese text: a service's message written for people (`EMPLOYEE_NUMBER_TAKEN`). */
const JAPANESE = /[぀-ヿ㐀-鿿＀-￯]/u;

const REFUSED: Record<DomainErrorCode, string> = {
  CONFLICT: "既に登録されているため、登録できませんでした",
  FORBIDDEN: "権限がないため、登録できませんでした",
  NOT_FOUND: "対象が見つからないため、登録できませんでした",
  VALIDATION: "入力内容に誤りがあるため、登録できませんでした",
};

/** The message a failed row shows (D8): the service's own when it speaks Japanese, else by kind. */
export const rowErrorMessage = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  if (isDomainError(error)) {
    return JAPANESE.test(error.message) ? error.message : REFUSED[error.code];
  }
  return "登録できませんでした";
};

/** 地域 and 都道府県 by name, as the row schemas look them up. */
export const loadCsvLookups = async (db: DbClient): Promise<CsvLookups> => {
  const source = createSourceRepository(db);
  const [regions, prefectures] = await Promise.all([
    source.findRegions(),
    source.findPrefectures(),
  ]);
  return {
    regionCodeByName: new Map(regions.map((region) => [region.name, region.code])),
    prefectureCodeByName: new Map(
      prefectures.map((prefecture) => [prefecture.name, prefecture.code]),
    ),
  };
};
