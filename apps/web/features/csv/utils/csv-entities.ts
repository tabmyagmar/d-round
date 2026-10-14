import type { CsvExportType, CsvImportType } from "@repo/validation";

import type { CsvEntity } from "@/features/csv/types";

/** What a list's 「CSV」 menu works with (the legacy `CsvMenus` props and download type). */
export type CsvEntityContent = {
  /** {label}を追加 / {label}を更新 in the menu; the list and rows the dialogs name. */
  label: string;
  /** The CASL subject: 追加 needs `create`, 更新 `update`, ダウンロード `read` of every row. */
  subject: "User" | "Staff" | "Client" | "Branch";
  createType: CsvImportType;
  updateType: CsvImportType;
  exportType: CsvExportType;
};

/**
 * The four lists with a 「CSV」 menu. The legacy menu said ユーザー for the 担当者 list, whose
 * page, button and dialogs say 担当者; the menu says 担当者 too.
 */
export const CSV_ENTITIES: Readonly<Record<CsvEntity, CsvEntityContent>> = {
  user: {
    label: "担当者",
    subject: "User",
    createType: "USER_CREATE",
    updateType: "USER_UPDATE",
    exportType: "USER",
  },
  staff: {
    label: "スタッフ",
    subject: "Staff",
    createType: "STAFF_CREATE",
    updateType: "STAFF_UPDATE",
    exportType: "STAFF",
  },
  client: {
    label: "クライアント",
    subject: "Client",
    createType: "CLIENT_CREATE",
    updateType: "CLIENT_UPDATE",
    exportType: "CLIENT",
  },
  branch: {
    label: "就業先部署",
    subject: "Branch",
    createType: "BRANCH_CREATE",
    updateType: "BRANCH_UPDATE",
    exportType: "BRANCH",
  },
};
