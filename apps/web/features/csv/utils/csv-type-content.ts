import type { CsvImportType } from "@repo/validation";
import {
  branchCreateCsv,
  branchUpdateCsv,
  clientCreateCsv,
  clientUpdateCsv,
  staffCreateCsv,
  staffUpdateCsv,
  userCreateCsv,
  userUpdateCsv,
} from "@repo/validation/csv";
import type { CsvTypeDefinition } from "@repo/validation/csv";

/**
 * A column of the 内容確認 and 結果 tables: lines of the row's cells (by column key, joined with a
 * space), the first one standing out — the legacy `CsvUploadHistory<Type>` cells.
 */
export type CsvSummaryColumn = {
  header: string;
  lines: readonly (readonly string[])[];
};

/** What the import dialog and 履歴 show for one CSV type (D12: no other code branches on it). */
export type CsvTypeContent = {
  /** The import dialog's title (legacy `CSV_UPLOAD_TITLE_MAP`). */
  title: string;
  /** 履歴's table title (legacy `CSV_UPLOAD_LIST_TITLE_MAP`). */
  historyTitle: string;
  /** Columns and row schema, shared with the worker's check. */
  definition: CsvTypeDefinition<unknown>;
  /** CSVデータフォーマット: the template under `public/csv/template`, headers as `definition`'s. */
  templatePath: string;
  /** CSVデータ説明書: the manual under `public/csv/manual`, placed by the deployment (README). */
  manualPath: string;
  summary: readonly CsvSummaryColumn[];
};

const userSummary = (verb: string): CsvSummaryColumn[] => [
  { header: "インポート先担当者情報", lines: [["role"], ["departmentName", "position"]] },
  { header: "担当者エリア・地域", lines: [["areas"], ["regionCodes"]] },
  {
    header: `${verb}担当者情報`,
    lines: [
      ["employeeNumber"],
      ["lastName", "firstName"],
      ["lastNameKana", "firstNameKana"],
      ["email"],
    ],
  },
];

const staffSummary = (verb: string): CsvSummaryColumn[] => [
  {
    header: `${verb}スタッフ情報`,
    lines: [
      ["employeeType", "employeeNumber"],
      ["lastName", "firstName"],
      ["lastNameKana", "firstNameKana"],
      ["email"],
    ],
  },
  { header: "配属先エリア（地域）", lines: [["areas"], ["regionCodes"], ["prefectureCodes"]] },
  { header: "担当者情報", lines: [["chargerEmails"]] },
];

const clientSummary = (verb: string): CsvSummaryColumn[] => [
  { header: `${verb}クライアント情報`, lines: [["number"], ["name", "nameKana"]] },
  { header: "エリア（地域）", lines: [["areas"], ["regionCodes"]] },
  { header: "担当者情報", lines: [["chargerEmails"]] },
];

const branchSummary = (verb: string): CsvSummaryColumn[] => [
  {
    header: `${verb}就業先部署情報`,
    lines: [
      ["clientNumber", "number"],
      ["name", "nameKana"],
    ],
  },
  { header: "エリア（地域）", lines: [["area"], ["regionCode"]] },
  { header: "担当者情報", lines: [["chargerEmails"]] },
  {
    header: "部署情報",
    lines: [["departmentNumber"], ["departmentName"], ["departmentNameKana"]],
  },
  {
    header: "連絡担当者",
    lines: [
      ["contactLastName", "contactFirstName"],
      ["contactLastNameKana", "contactFirstNameKana"],
      // 役職 and メール on lines of their own keep the column narrow, so 説明欄 stays in view.
      ["contactPosition"],
      ["contactEmail"],
    ],
  },
];

const ADDED = "追加される";
const UPDATED = "更新される";

/** Every CSV type (legacy `titleMap.ts` and `fileMap.ts`); the update templates exist for all four. */
export const CSV_TYPE_CONTENT: Readonly<Record<CsvImportType, CsvTypeContent>> = {
  USER_CREATE: {
    title: "CSVから担当者を追加",
    historyTitle: "CSVインポート担当者追加一覧",
    definition: userCreateCsv,
    templatePath: "/csv/template/USER/CSV 担当者情報追加.csv",
    manualPath: "/csv/manual/user.pdf",
    summary: userSummary(ADDED),
  },
  USER_UPDATE: {
    title: "CSVから担当者を更新",
    historyTitle: "CSVインポート担当者更新一覧",
    definition: userUpdateCsv,
    templatePath: "/csv/template/USER/CSV 担当者情報更新.csv",
    manualPath: "/csv/manual/user.pdf",
    summary: userSummary(UPDATED),
  },
  STAFF_CREATE: {
    title: "CSVからスタッフメンバーを追加",
    historyTitle: "CSVインポートスタッフ追加一覧",
    definition: staffCreateCsv,
    templatePath: "/csv/template/STAFF/CSV スタッフ情報追加.csv",
    manualPath: "/csv/manual/staff.pdf",
    summary: staffSummary(ADDED),
  },
  STAFF_UPDATE: {
    title: "CSVからスタッフメンバーを更新",
    historyTitle: "CSVインポートスタッフ更新一覧",
    definition: staffUpdateCsv,
    templatePath: "/csv/template/STAFF/CSV スタッフ情報更新.csv",
    manualPath: "/csv/manual/staff.pdf",
    summary: staffSummary(UPDATED),
  },
  CLIENT_CREATE: {
    title: "CSVからクライアントを追加",
    historyTitle: "CSVインポートクライアント追加一覧",
    definition: clientCreateCsv,
    templatePath: "/csv/template/CLIENT/CSV クライアント情報追加.csv",
    manualPath: "/csv/manual/client.pdf",
    summary: clientSummary(ADDED),
  },
  CLIENT_UPDATE: {
    title: "CSVからクライアントを更新",
    historyTitle: "CSVインポートクライアント更新一覧",
    definition: clientUpdateCsv,
    templatePath: "/csv/template/CLIENT/CSV クライアント情報更新.csv",
    manualPath: "/csv/manual/client.pdf",
    summary: clientSummary(UPDATED),
  },
  BRANCH_CREATE: {
    title: "CSVから就業先部署を追加",
    historyTitle: "CSVインポート就業先追加一覧",
    definition: branchCreateCsv,
    templatePath: "/csv/template/BRANCH/CSV 就業先部署情報追加.csv",
    manualPath: "/csv/manual/branch.pdf",
    summary: branchSummary(ADDED),
  },
  BRANCH_UPDATE: {
    title: "CSVから就業先部署を更新",
    historyTitle: "CSVインポート就業先更新一覧",
    definition: branchUpdateCsv,
    templatePath: "/csv/template/BRANCH/CSV 就業先部署情報更新.csv",
    manualPath: "/csv/manual/branch.pdf",
    summary: branchSummary(UPDATED),
  },
};

/** A summary line's text: its cells joined with a space, empty cells left out. */
export const summaryLineOf = (data: unknown, keys: readonly string[]): string =>
  keys
    .map((key) => {
      const value =
        typeof data === "object" && data !== null ? (data as Record<string, unknown>)[key] : "";
      return typeof value === "string" ? value : "";
    })
    .filter((value) => value !== "")
    .join(" ");
