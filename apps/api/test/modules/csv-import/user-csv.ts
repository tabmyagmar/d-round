import { createUploadUrlSchema } from "@repo/validation";
import type { CsvImportType } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { createUploadUrl } from "../../../src/modules/attachment/attachment.service";
import * as csvImportService from "../../../src/modules/csv-import/csv-import.service";
import { uniqueEmployeeNumber } from "../../support";
import type { TestHarness } from "../../support";

/** 担当者 CSV files for the CSV import tests: the legacy template's header and its rows. */

export const USER_CSV_HEADER =
  "社員番号（必須）,姓（必須）,名（必須）,セイ（必須）,メイ（必須）,エリア（必須）,地区（必須）,部署名（必須）,役職（必須）,メールアドレス（必須）,アカウントタイプ（必須）,退職日";

export type UserCsvLine = {
  employeeNumber: string;
  lastName: string;
  lastNameKana: string;
  regions: string;
  position: string;
  email: string;
  role: string;
};

/** One data row with unique 社員番号 and address unless given; `text` is the CSV line. */
export const userLine = (overrides: Partial<UserCsvLine> = {}) => {
  const line: UserCsvLine = {
    employeeNumber: String(uniqueEmployeeNumber()),
    lastName: "山田",
    lastNameKana: "ヤマダ",
    regions: "南関東",
    position: "正社員",
    email: `${crypto.randomUUID()}@example.com`,
    role: "AM",
    ...overrides,
  };
  return {
    ...line,
    text: [
      line.employeeNumber,
      line.lastName,
      "太郎",
      line.lastNameKana,
      "タロウ",
      "東日本",
      `"${line.regions}"`,
      "人事部",
      line.position,
      line.email,
      line.role,
      "",
    ].join(","),
  };
};

export const userCsv = (...lines: string[]) => [USER_CSV_HEADER, ...lines].join("\r\n");

/**
 * Uploads `text` as the browser does — an upload URL of kind CSV_IMPORT, then the PUT into the
 * memory bucket — and starts its import through the service.
 */
export const startImport = async (
  h: TestHarness,
  ctx: RequestContext,
  text: string,
  type: CsvImportType = "USER_CREATE",
) => {
  const body = new TextEncoder().encode(text);
  const target = await createUploadUrl(
    ctx,
    createUploadUrlSchema.parse({
      kind: "CSV_IMPORT",
      fileName: "担当者.csv",
      contentType: "text/csv",
      size: body.length,
    }),
  );
  const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
  h.storage.put(row.objectKey, { size: body.length, contentType: "text/csv", body });
  return csvImportService.create(ctx, { type, attachmentId: target.id });
};
