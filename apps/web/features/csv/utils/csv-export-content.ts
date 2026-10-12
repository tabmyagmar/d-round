import {
  BRANCH_EXPORT_FIELDS,
  CLIENT_EXPORT_FIELDS,
  FAMILY_RELATIONS,
  STAFF_EXPORT_FIELDS,
  USER_EXPORT_FIELDS,
} from "@repo/validation";
import type { CsvExportField, CsvExportType, createCsvExportSchema, z } from "@repo/validation";
import { FAMILY_RELATION_BY_LABEL, labelOf } from "@repo/validation/csv";

/** One collapsible checkbox list of the download dialog: a sheet's columns, or the 続柄. */
export type CsvExportGroup = {
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
};

/** What the download dialog shows for one type (legacy `<Type>CsvDownloadContent`). */
export type CsvExportContent = {
  title: string;
  groups: readonly CsvExportGroup[];
  /** Ticked when the dialog opens: the main sheet's columns (legacy `default: true`). */
  initial: readonly string[];
  /** The ticked values as `csvExport.create`'s input. */
  inputOf: (ids: string[], values: readonly string[]) => z.input<typeof createCsvExportSchema>;
};

// A value names its group, so the same column key in two groups stays two boxes.
const valueOf = (group: string, key: string) => `${group}:${key}`;

const columnsGroup = (key: string, label: string, fields: readonly CsvExportField[]) => ({
  key,
  label,
  options: fields.map((field) => ({ value: valueOf(key, field.key), label: field.header })),
});

const picked = <K extends string>(
  values: readonly string[],
  group: string,
  keys: readonly K[],
): K[] => keys.filter((key) => values.includes(valueOf(group, key)));

const keysOf = <K extends string>(fields: readonly CsvExportField<K>[]): K[] =>
  fields.map((field) => field.key);

const allOf = (group: string, fields: readonly CsvExportField[]) =>
  fields.map((field) => valueOf(group, field.key));

/**
 * Every download type. The extra sheets (家族情報, a client's 就業先部署情報) start unticked, as
 * in the legacy, where they were optional; ticking any of them adds the sheet.
 */
export const CSV_EXPORT_CONTENT: Readonly<Record<CsvExportType, CsvExportContent>> = {
  USER: {
    title: "担当者情報 ダウンロード",
    groups: [columnsGroup("fields", "担当者情報", USER_EXPORT_FIELDS)],
    initial: allOf("fields", USER_EXPORT_FIELDS),
    inputOf: (ids, values) => ({
      type: "USER",
      ids,
      fields: picked(values, "fields", keysOf(USER_EXPORT_FIELDS)),
    }),
  },
  STAFF: {
    title: "スタッフ情報 ダウンロード",
    groups: [
      columnsGroup("fields", "スタッフ情報", STAFF_EXPORT_FIELDS),
      {
        key: "familyRelations",
        label: "家族情報",
        options: FAMILY_RELATIONS.map((relation) => ({
          value: valueOf("familyRelations", relation),
          label: labelOf(FAMILY_RELATION_BY_LABEL, relation),
        })),
      },
    ],
    initial: allOf("fields", STAFF_EXPORT_FIELDS),
    inputOf: (ids, values) => ({
      type: "STAFF",
      ids,
      fields: picked(values, "fields", keysOf(STAFF_EXPORT_FIELDS)),
      familyRelations: picked(values, "familyRelations", FAMILY_RELATIONS),
    }),
  },
  CLIENT: {
    title: "クライアント情報 ダウンロード",
    groups: [
      columnsGroup("fields", "クライアント基本情報", CLIENT_EXPORT_FIELDS),
      columnsGroup("branchFields", "就業先部署情報", BRANCH_EXPORT_FIELDS),
    ],
    initial: allOf("fields", CLIENT_EXPORT_FIELDS),
    inputOf: (ids, values) => ({
      type: "CLIENT",
      ids,
      fields: picked(values, "fields", keysOf(CLIENT_EXPORT_FIELDS)),
      branchFields: picked(values, "branchFields", keysOf(BRANCH_EXPORT_FIELDS)),
    }),
  },
  BRANCH: {
    title: "就業先部署情報 ダウンロード",
    groups: [columnsGroup("fields", "就業先部署情報", BRANCH_EXPORT_FIELDS)],
    initial: allOf("fields", BRANCH_EXPORT_FIELDS),
    inputOf: (ids, values) => ({
      type: "BRANCH",
      ids,
      fields: picked(values, "fields", keysOf(BRANCH_EXPORT_FIELDS)),
    }),
  },
};
