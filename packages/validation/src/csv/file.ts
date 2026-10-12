import { CsvError, parse } from "csv-parse/browser/esm/sync";

/**
 * Reading and writing CSV files (docs/adr/0013-csv-import.md). The browser runs these on the picked
 * file for instant feedback, the worker on the stored file; the same code decides both.
 */

/** Data rows one file may hold (the legacy limit, now inclusive). */
export const CSV_MAX_ROWS = 150;

/** A cell's value by column key, trimmed. Columns the file lacks are absent. */
export type CsvCells = Readonly<Record<string, string>>;

/** One data row and its row number as Excel shows it: the header is row 1. */
export type ParsedCsvLine = { lineNumber: number; cells: CsvCells };

/** A column of a CSV type: its key, its header in the template, other headers it accepts. */
export type CsvColumn = {
  key: string;
  /** The template's header, e.g. `姓（必須）`. */
  header: string;
  /** Older or shorter headers that mean the same column. */
  aliases?: readonly string[];
  /** The file must have this column. */
  required?: boolean;
};

export type ParsedCsv = {
  lines: ParsedCsvLine[];
  /** A finding about the whole file; when set, `lines` is empty and nothing can be imported. */
  fileError: string | null;
};

/** The column's name in messages: its header without the template's （必須）. */
export const columnLabel = (column: CsvColumn): string =>
  column.header.replace(/[（(]必須[）)]\s*$/u, "").trim();

/**
 * The file's text: UTF-8 (with or without a BOM) when the bytes are valid UTF-8, Shift_JIS
 * otherwise — what Excel writes on Japanese Windows. The BOM is dropped.
 */
export const decodeCsv = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
};

const fileFailure = (fileError: string): ParsedCsv => ({ lines: [], fileError });

const normalizedHeader = (header: string) => header.replace(/\s+/gu, "").trim();

/**
 * The data rows of a CSV text, keyed by the type's columns. Every cell stays a string (leading
 * zeros of 郵便番号 and 電話番号 survive); headers the type does not know are ignored; rows whose
 * cells are all empty are skipped but still counted, so row numbers match Excel's.
 */
export const parseCsv = (text: string, columns: readonly CsvColumn[]): ParsedCsv => {
  let records: string[][];
  try {
    records = parse(text, { bom: true, relax_column_count: true, skip_empty_lines: false });
  } catch (error) {
    const line = error instanceof CsvError ? (error as CsvError & { lines?: number }).lines : null;
    return fileFailure(
      line
        ? `CSVの形式が正しくありません（${String(line)}行目付近）`
        : "CSVの形式が正しくありません",
    );
  }

  const [header, ...rows] = records;
  if (!header || header.every((cell) => cell.trim() === "")) {
    return fileFailure("CSVに見出しの行がありません");
  }

  const keyByHeader = new Map<string, string>();
  for (const column of columns) {
    for (const name of [column.header, ...(column.aliases ?? [])]) {
      keyByHeader.set(normalizedHeader(name), column.key);
    }
  }
  const keyAtIndex = header.map((cell) => keyByHeader.get(normalizedHeader(cell)));
  const missing = columns.filter((column) => column.required && !keyAtIndex.includes(column.key));
  if (missing.length > 0) {
    return fileFailure(
      `必要な列がありません: ${missing.map((column) => column.header).join("、")}`,
    );
  }

  const lines: ParsedCsvLine[] = [];
  rows.forEach((row, index) => {
    const cells: Record<string, string> = {};
    keyAtIndex.forEach((key, column) => {
      // The first column with a key wins when a file repeats a header.
      if (key && !(key in cells)) {
        cells[key] = (row[column] ?? "").trim();
      }
    });
    if (Object.values(cells).some((value) => value !== "")) {
      lines.push({ lineNumber: index + 2, cells });
    }
  });

  if (lines.length === 0) {
    return fileFailure("CSVにデータの行がありません");
  }
  if (lines.length > CSV_MAX_ROWS) {
    return fileFailure(
      `一度に取り込めるのは${String(CSV_MAX_ROWS)}件までです（${String(lines.length)}件）。ファイルを分けてください`,
    );
  }
  return { lines, fileError: null };
};

const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * CSV text Excel opens as is: UTF-8 with a BOM, CRLF line ends, every field quoted (a line break
 * inside a cell stays inside it) — the legacy error list's format.
 */
export const toCsvText = (rows: readonly (readonly string[])[]): string =>
  `\uFEFF${rows.map((row) => row.map(quoted).join(",")).join("\r\n")}\r\n`;
