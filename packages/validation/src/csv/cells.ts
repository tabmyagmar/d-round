import { z } from "zod";

import { toHalfWidthDigits } from "../common.schema";

/**
 * Cell readers for the CSV row schemas: each takes the cell's text (always a string, "" when
 * empty) and hands the form's own schema the value it expects, so the rule and the message are
 * the form's. A value the cell cannot be read as is an issue of its own.
 */

/** Text for a form schema; an empty cell stays "" so the schema's required message shows. */
export const textCell = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" ? value : ""), schema);

/** Optional text: an empty cell is `null`. */
export const optionalTextCell = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value !== "" ? value : null), schema);

/** The digits of a cell as a number (full-width digits too); other text is an issue. */
const readInteger = (label: string, value: string, context: z.core.$RefinementCtx) => {
  const digits = toHalfWidthDigits(value);
  if (!/^\d+$/.test(digits)) {
    context.addIssue({ code: "custom", message: `${label}は半角数字で入力してください` });
    return z.NEVER;
  }
  return Number(digits);
};

/**
 * A whole number for a form schema (`employeeNumberSchema("社員番号")`): an empty cell is
 * `undefined`, so the schema's required message shows.
 */
export const integerCell = <T extends z.ZodType>(label: string, schema: T) =>
  z.preprocess(
    (value, context) =>
      typeof value === "string" && value !== "" ? readInteger(label, value, context) : undefined,
    schema,
  );

/** An optional whole number: an empty cell is `null`; a number still meets the schema. */
export const optionalIntegerCell = <T extends z.ZodType>(label: string, schema: T) =>
  z.preprocess(
    (value, context) =>
      typeof value === "string" && value !== "" ? readInteger(label, value, context) : null,
    schema.nullable(),
  );

const allowed = (labels: readonly string[]) => labels.join("、");

/**
 * One of a closed set written as its label (`東日本` → `EAST`), as the legacy templates: an unknown
 * label names the allowed ones. An empty cell is `undefined`, so a required schema says so.
 */
export const labelCell = <TCode extends string>(
  codeByLabel: Readonly<Record<string, TCode>>,
  required: string,
) =>
  z.string().transform((value, context) => {
    if (value === "") {
      context.addIssue({ code: "custom", message: required });
      return z.NEVER;
    }
    const code = Object.hasOwn(codeByLabel, value) ? codeByLabel[value] : undefined;
    if (code === undefined) {
      context.addIssue({
        code: "custom",
        message: `「${value}」は使えません（${allowed(Object.keys(codeByLabel))}）`,
      });
      return z.NEVER;
    }
    return code;
  });

/** Several labels in one cell, separated by commas (、 and ， too). */
const splitList = (value: string) =>
  value
    .split(/[,、，]/u)
    .map((item) => item.trim())
    .filter((item) => item !== "");

/**
 * Several values of a closed set or of reference data in one cell (`北海道,東北`), each looked up
 * by name; an unknown or repeated name is an issue (the legacy `validateRegions`). An empty cell
 * is the `required` issue.
 */
export const listCell = <TCode>(
  codeByName: (name: string) => TCode | undefined,
  names: () => readonly string[],
  required: string,
) =>
  z.string().transform((value, context) => {
    const items = splitList(value);
    if (items.length === 0) {
      context.addIssue({ code: "custom", message: required });
      return z.NEVER;
    }
    const codes: TCode[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item)) {
        context.addIssue({ code: "custom", message: `「${item}」が重複しています` });
        continue;
      }
      seen.add(item);
      const code = codeByName(item);
      if (code === undefined) {
        context.addIssue({
          code: "custom",
          message: `「${item}」は使えません（${allowed(names())}）`,
        });
      } else {
        codes.push(code);
      }
    }
    return codes;
  });

/** A `listCell` over labels of a closed set. */
export const labelListCell = <TCode extends string>(
  codeByLabel: Readonly<Record<string, TCode>>,
  required: string,
) =>
  listCell(
    (label) => (Object.hasOwn(codeByLabel, label) ? codeByLabel[label] : undefined),
    () => Object.keys(codeByLabel),
    required,
  );

/** A `listCell` over reference data loaded at run time (地域 names → region codes). */
export const nameListCell = (codeByName: ReadonlyMap<string, number>, required: string) =>
  listCell(
    (name) => codeByName.get(name),
    () => [...codeByName.keys()],
    required,
  );

const DATE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/u;

/**
 * An optional date as Excel writes it (`2026/1/5`, `2026/01/05`, `2026-01-05`) → `yyyy-MM-dd`, the
 * forms' format; a day that does not exist is refused. An empty cell is `null`.
 */
export const dateCell = () =>
  z.string().transform((value, context) => {
    if (value === "") {
      return null;
    }
    const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = (
      DATE.exec(toHalfWidthDigits(value))?.slice(1) ?? []
    ).map(Number);
    // Date.UTC rolls 2026/2/30 over to March: a day that does not exist reads back differently.
    const date = new Date(Date.UTC(year, month - 1, day));
    const exists =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    if (!exists) {
      context.addIssue({ code: "custom", message: "日付は YYYY/MM/DD の形式で入力してください" });
      return z.NEVER;
    }
    return date.toISOString().slice(0, 10);
  });
