import {
  BRANCH_EXPORT_FIELDS,
  CLIENT_EXPORT_FIELDS,
  FAMILY_RELATIONS,
  STAFF_EXPORT_FIELDS,
  USER_EXPORT_FIELDS,
} from "@repo/validation";
import type { CsvExportField, CsvExportType, createCsvExportSchema, z } from "@repo/validation";

import { FAMILY_RELATION_OPTIONS } from "@/lib/family-relation-labels";

/** One closed checkbox list of the download dialog: a sheet's columns, or the 続柄. */
export type CsvExportGroup = {
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
};

/** The values ticked in each group, by the group's key. */
export type CsvExportPicks = Readonly<Record<string, readonly string[]>>;

/** What the download dialog shows for one type (legacy `<Type>CsvDownloadContent`). */
export type CsvExportContent = {
  title: string;
  groups: readonly CsvExportGroup[];
  /** Ticked when the dialog opens: the main sheet's columns (legacy `default: true`). */
  initial: CsvExportPicks;
  /** The ticked values as `csvExport.create`'s input, which its schema then checks. */
  inputOf: (ids: string[], picks: CsvExportPicks) => z.input<typeof createCsvExportSchema>;
};

const optionsOf = (fields: readonly CsvExportField[]) =>
  fields.map((field) => ({ value: field.key, label: field.header }));

const keysOf = <K extends string>(fields: readonly CsvExportField<K>[]): K[] =>
  fields.map((field) => field.key);

/** The keys ticked in a group, in the file's order. */
const picked = <K extends string>(keys: readonly K[], values: readonly string[] | undefined): K[] =>
  keys.filter((key) => values?.includes(key) ?? false);

/**
 * Every download type. The extra sheets (家族情報, a client's 就業先部署情報) start unticked, as in
 * the legacy, where they were optional; ticking any of them adds the sheet.
 */
export const CSV_EXPORT_CONTENT: Readonly<Record<CsvExportType, CsvExportContent>> = {
  USER: {
    title: "担当者情報 ダウンロード",
    groups: [{ key: "fields", label: "担当者情報", options: optionsOf(USER_EXPORT_FIELDS) }],
    initial: { fields: keysOf(USER_EXPORT_FIELDS) },
    inputOf: (ids, picks) => ({
      type: "USER",
      ids,
      fields: picked(keysOf(USER_EXPORT_FIELDS), picks.fields),
    }),
  },
  STAFF: {
    title: "スタッフ情報 ダウンロード",
    groups: [
      { key: "fields", label: "スタッフ情報", options: optionsOf(STAFF_EXPORT_FIELDS) },
      { key: "familyRelations", label: "家族情報", options: FAMILY_RELATION_OPTIONS },
    ],
    initial: { fields: keysOf(STAFF_EXPORT_FIELDS) },
    inputOf: (ids, picks) => ({
      type: "STAFF",
      ids,
      fields: picked(keysOf(STAFF_EXPORT_FIELDS), picks.fields),
      familyRelations: picked(FAMILY_RELATIONS, picks.familyRelations),
    }),
  },
  CLIENT: {
    title: "クライアント情報 ダウンロード",
    groups: [
      { key: "fields", label: "クライアント基本情報", options: optionsOf(CLIENT_EXPORT_FIELDS) },
      { key: "branchFields", label: "就業先部署情報", options: optionsOf(BRANCH_EXPORT_FIELDS) },
    ],
    initial: { fields: keysOf(CLIENT_EXPORT_FIELDS) },
    inputOf: (ids, picks) => ({
      type: "CLIENT",
      ids,
      fields: picked(keysOf(CLIENT_EXPORT_FIELDS), picks.fields),
      branchFields: picked(keysOf(BRANCH_EXPORT_FIELDS), picks.branchFields),
    }),
  },
  BRANCH: {
    title: "就業先部署情報 ダウンロード",
    groups: [{ key: "fields", label: "就業先部署情報", options: optionsOf(BRANCH_EXPORT_FIELDS) }],
    initial: { fields: keysOf(BRANCH_EXPORT_FIELDS) },
    inputOf: (ids, picks) => ({
      type: "BRANCH",
      ids,
      fields: picked(keysOf(BRANCH_EXPORT_FIELDS), picks.fields),
    }),
  },
};
