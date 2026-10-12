import { checkCsvLines, decodeCsv, parseCsv } from "@repo/validation/csv";
import type { CsvLookups, CsvTypeDefinition } from "@repo/validation/csv";

/** A line the check refused: its row number as Excel shows it and its messages. */
export type CsvLineError = { lineNumber: number; errors: string[] };

/** What the browser found in a picked file; nothing found, the file may be uploaded. */
export type CsvFileCheck = {
  /** About the whole file: no header, a missing column, no rows, more than 150 rows. */
  fileError: string | null;
  lineErrors: CsvLineError[];
};

/**
 * The browser's check of a picked file before it is uploaded (legacy `validateCsv`): the same
 * decoding, parsing and row schema the worker runs on the stored file, without the database
 * checks, so a format error shows at once with its line.
 */
export const checkCsvFile = (
  bytes: Uint8Array,
  definition: CsvTypeDefinition<unknown>,
  lookups: CsvLookups,
): CsvFileCheck => {
  const parsed = parseCsv(decodeCsv(bytes), definition.columns);
  if (parsed.fileError) {
    return { fileError: parsed.fileError, lineErrors: [] };
  }
  return {
    fileError: null,
    lineErrors: checkCsvLines(definition, parsed.lines, lookups).flatMap((line) =>
      line.errors.length > 0 ? [{ lineNumber: line.lineNumber, errors: line.errors }] : [],
    ),
  };
};

/** The names the row schemas turn into codes, from `source.regions` and `source.prefectures`. */
export const csvLookupsOf = (hierarchy: {
  regions: readonly { code: number; name: string }[];
  prefectures: readonly { code: number; name: string }[];
}): CsvLookups => ({
  regionCodeByName: new Map(hierarchy.regions.map((region) => [region.name, region.code])),
  prefectureCodeByName: new Map(
    hierarchy.prefectures.map((prefecture) => [prefecture.name, prefecture.code]),
  ),
});
