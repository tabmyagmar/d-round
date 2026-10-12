import type { z } from "zod";

import type { CsvImportType } from "../csv-import.schema";

import { columnLabel } from "./file";
import type { CsvColumn, ParsedCsvLine } from "./file";

export { CSV_IMPORT_TYPES, csvImportTypeSchema } from "../csv-import.schema";
export type { CsvImportType } from "../csv-import.schema";

/**
 * Reference data the row schemas turn names into codes with (地域, 都道府県): the browser has it
 * from the source procedures, the worker reads it from the database — both check the same way.
 */
export type CsvLookups = {
  regionCodeByName: ReadonlyMap<string, number>;
  prefectureCodeByName: ReadonlyMap<string, number>;
};

/**
 * One CSV type, defined once for the browser and the worker: its columns (the legacy template's
 * headers, in order), the values that must not repeat within a file, and the row schema — built
 * from the forms' own schema pieces, so a CSV rule and its message never drift from the form's.
 */
export type CsvTypeDefinition<TRow> = {
  type: CsvImportType;
  columns: readonly CsvColumn[];
  /** Column keys whose values must be unique within one file (compared trimmed, lower-cased). */
  uniqueKeys: readonly string[];
  /** Cells → the row the importer works with; issues name their column key as the path. */
  rowSchema: (lookups: CsvLookups) => z.ZodType<TRow>;
};

export const defineCsvType = <TRow>(definition: CsvTypeDefinition<TRow>) => definition;

/** A data row after the format check: its typed row when it has no errors. */
export type CheckedCsvLine<TRow> = ParsedCsvLine & {
  row: TRow | null;
  /** `列名: メッセージ` (the legacy check's form), or the form's message when it names the column. */
  errors: string[];
};

const labelOf = (columns: readonly CsvColumn[], key: PropertyKey | undefined) => {
  const column = columns.find((candidate) => candidate.key === key);
  return column ? columnLabel(column) : null;
};

/**
 * The format check of every row — the browser's whole check, the first half of the worker's: the
 * row schema, then values repeated within the file (each repeat after the first is an error, as
 * the legacy `validateUniqueInCsv`).
 */
export const checkCsvLines = <TRow>(
  definition: CsvTypeDefinition<TRow>,
  lines: readonly ParsedCsvLine[],
  lookups: CsvLookups,
): CheckedCsvLine<TRow>[] => {
  const schema = definition.rowSchema(lookups);
  const seen = new Map(definition.uniqueKeys.map((key) => [key, new Set<string>()]));

  return lines.map((line) => {
    const errors: string[] = [];
    const parsed = schema.safeParse(line.cells);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        // The forms' messages often name the field already (姓を入力してください).
        const label = labelOf(definition.columns, issue.path[0]);
        errors.push(
          label && !issue.message.startsWith(label) ? `${label}: ${issue.message}` : issue.message,
        );
      }
    }
    for (const [key, values] of seen) {
      const value = line.cells[key]?.trim().toLowerCase() ?? "";
      if (value === "") {
        continue;
      }
      if (values.has(value)) {
        errors.push(`${labelOf(definition.columns, key) ?? key}: ${value} CSV内で重複しています`);
      } else {
        values.add(value);
      }
    }
    return { ...line, row: parsed.success && errors.length === 0 ? parsed.data : null, errors };
  });
};
