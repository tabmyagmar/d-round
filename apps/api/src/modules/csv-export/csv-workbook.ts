import { utils, write } from "xlsx";

/** One sheet of a ダウンロード: its tab name and its rows, the header first. Every cell is text. */
export type CsvSheet = { name: string; rows: string[][] };

/** A column of a sheet: its header and the cell of each row. */
export type CsvSheetColumn<Row> = { header: string; cell: (row: Row) => string };

export const sheetOf = <Row>(
  name: string,
  columns: readonly CsvSheetColumn<Row>[],
  rows: readonly Row[],
): CsvSheet => ({
  name,
  rows: [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.cell(row))),
  ],
});

/**
 * The sheets as xlsx bytes, written as the legacy wrote them (SheetJS `write` with
 * `bookType: "xlsx"` and `compression: true`, every cell a string as its `getCellValue` made it).
 */
export const toXlsx = (sheets: readonly CsvSheet[]): Uint8Array => {
  const workbook = utils.book_new();
  for (const sheet of sheets) {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  return write(workbook, { type: "buffer", bookType: "xlsx", compression: true }) as Uint8Array;
};
