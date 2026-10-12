import {
  createBranchRepository,
  createClientRepository,
  createCsvExportRepository,
  createStaffRepository,
  createUserRepository,
  withTransaction,
} from "@repo/database";
import type { BranchRow, CsvExport, CsvExportListItem, PageResult, Prisma } from "@repo/database";
import { TIME_ZONE, dayjs } from "@repo/dayjs";
import {
  accessibleBranchesWhere,
  accessibleClientsWhere,
  accessibleStaffWhere,
  accessibleUsersWhere,
  canUnscoped,
} from "@repo/permissions/server";
import {
  BRANCH_EXPORT_FIELDS,
  CLIENT_EXPORT_FIELDS,
  STAFF_EXPORT_FIELDS,
  USER_EXPORT_FIELDS,
  XLSX_CONTENT_TYPE,
} from "@repo/validation";
import type {
  BranchExportField,
  CreateCsvExportInput,
  CsvExportType,
  ListCsvExportsQuery,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, NotFoundError } from "../../core/errors";
import { storeFile, syncAttachments, viewsOf } from "../attachment/attachment.service";

import {
  BRANCH_CELLS,
  BRANCH_CLIENT_COLUMNS,
  CLIENT_CELLS,
  FAMILY_COLUMNS,
  STAFF_CELLS,
  USER_CELLS,
  columnsOf,
} from "./csv-exporters";
import { sheetOf, toXlsx } from "./csv-workbook";
import type { CsvSheet } from "./csv-workbook";

/**
 * CSV ダウンロード (docs/adr/0013-csv-import.md): the rows ticked in a list as an xlsx, written at
 * once (500 rows at most, no job), kept as an attachment so 履歴 hands out the same file again, and
 * answered with a signed read URL. Every download is its maker's only (the legacy rule).
 */

/** A download with a read URL of its file (ATTACHMENT_URL_TTL_SECONDS). */
export type CsvExportFile = CsvExport & { url: string };

/** What each type reads, so the grant its maker needs besides catalog 1402, and its file name. */
const EXPORTS = {
  USER: { subject: "User", label: "担当者", fileName: "UserData" },
  STAFF: { subject: "Staff", label: "スタッフ", fileName: "StaffData" },
  CLIENT: { subject: "Client", label: "クライアント", fileName: "ClientData" },
  BRANCH: { subject: "Branch", label: "就業先部署", fileName: "BranchData" },
} as const satisfies Record<
  CsvExportType,
  { subject: "User" | "Staff" | "Client" | "Branch"; label: string; fileName: string }
>;

const makerOf = (ctx: RequestContext) => {
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  return ctx.user;
};

/** Catalog 1402 and the grant to read every row of the entity (the self rule is not enough). */
const assertMayExport = (ctx: RequestContext, type: CsvExportType): void => {
  const { subject, label } = EXPORTS[type];
  if (!ctx.ability.can("read", "SourceCsvHistory") || !canUnscoped(ctx.ability, "read", subject)) {
    throw new ForbiddenError(`${label}をダウンロードする権限がありません`);
  }
};

/** The caller's own download; another user's is not found, so its existence does not leak. */
const ownExport = async (ctx: RequestContext, csvExportId: string): Promise<CsvExport> => {
  const maker = makerOf(ctx);
  const csvExport = await createCsvExportRepository(ctx.db).findById(csvExportId);
  if (csvExport?.createdById !== maker.id) {
    throw new NotFoundError("CsvExport", csvExportId);
  }
  return csvExport;
};

const urlOf = async (ctx: RequestContext, csvExportId: string): Promise<string> => {
  const [file] = await viewsOf(ctx, { kind: "CSV_EXPORT", owner: { csvExportId } });
  if (!file) {
    throw new NotFoundError("CsvExport file", csvExportId);
  }
  return file.url;
};

const branchesOf = (ctx: RequestContext, where: Prisma.BranchWhereInput): Promise<BranchRow[]> =>
  createBranchRepository(ctx.db).findManyDetailed({
    AND: [accessibleBranchesWhere(ctx.ability, "read"), where],
  });

/** 就業先部署情報: each branch's client first, then the columns picked. */
const branchSheetOf = (branches: BranchRow[], fields: readonly BranchExportField[]): CsvSheet =>
  sheetOf(
    "就業先部署情報",
    [...BRANCH_CLIENT_COLUMNS, ...columnsOf(BRANCH_EXPORT_FIELDS, fields, BRANCH_CELLS)],
    branches,
  );

/**
 * The type's sheets (legacy `download<Type>Csv`), by number. An id the caller may not read, or of a
 * deleted row, is left out; a 停止 担当者 is not deleted and stays in, as the list shows them.
 */
const sheetsOf = async (
  ctx: RequestContext,
  input: CreateCsvExportInput,
): Promise<{ sheets: CsvSheet[]; rowCount: number }> => {
  const ticked = { id: { in: input.ids } };
  switch (input.type) {
    case "USER": {
      const users = await createUserRepository(ctx.db).findManyIncludingDeleted({
        AND: [accessibleUsersWhere(ctx.ability, "read"), ticked],
      });
      const columns = columnsOf(USER_EXPORT_FIELDS, input.fields, USER_CELLS);
      return { rowCount: users.length, sheets: [sheetOf("担当者情報", columns, users)] };
    }
    case "STAFF": {
      const staff = await createStaffRepository(ctx.db).findManyDetailed({
        AND: [accessibleStaffWhere(ctx.ability, "read"), ticked],
      });
      const columns = columnsOf(STAFF_EXPORT_FIELDS, input.fields, STAFF_CELLS);
      const sheets = [sheetOf("スタッフ情報", columns, staff)];
      if (input.familyRelations.length > 0) {
        const members = staff.flatMap((row) =>
          row.familyMembers
            .filter((member) => member.relation && input.familyRelations.includes(member.relation))
            .map((member) => ({ ...member, employeeNumber: row.employeeNumber })),
        );
        sheets.push(sheetOf("家族情報", FAMILY_COLUMNS, members));
      }
      return { rowCount: staff.length, sheets };
    }
    case "CLIENT": {
      const clients = await createClientRepository(ctx.db).findManyDetailed({
        AND: [accessibleClientsWhere(ctx.ability, "read"), ticked],
      });
      const columns = columnsOf(CLIENT_EXPORT_FIELDS, input.fields, CLIENT_CELLS);
      const sheets = [sheetOf("クライアント情報", columns, clients)];
      if (input.branchFields.length > 0) {
        // The branches are read too: their sheet needs the branch grant as well.
        assertMayExport(ctx, "BRANCH");
        const branches = await branchesOf(ctx, {
          clientId: { in: clients.map((client) => client.id) },
        });
        sheets.push(branchSheetOf(branches, input.branchFields));
      }
      return { rowCount: clients.length, sheets };
    }
    case "BRANCH": {
      const branches = await branchesOf(ctx, ticked);
      return { rowCount: branches.length, sheets: [branchSheetOf(branches, input.fields)] };
    }
  }
};

/**
 * Writes the download: the workbook to the bucket (`storeFile`), then its row and the file's
 * attachment in one transaction, then a read URL. Named as the legacy named it, by the day in Japan.
 */
export const create = async (
  ctx: RequestContext,
  input: CreateCsvExportInput,
): Promise<CsvExportFile> => {
  const maker = makerOf(ctx);
  assertMayExport(ctx, input.type);
  const { sheets, rowCount } = await sheetsOf(ctx, input);
  const fileName = `${EXPORTS[input.type].fileName}_${dayjs().tz(TIME_ZONE).format("YYYYMMDD")}.xlsx`;
  const attachmentId = await storeFile(ctx, "CSV_EXPORT", {
    fileName,
    contentType: XLSX_CONTENT_TYPE,
    body: toXlsx(sheets),
  });

  const csvExport = await withTransaction(ctx.db, async (transaction) => {
    const created = await createCsvExportRepository(transaction.tx).create({
      type: input.type,
      fileName,
      rowCount,
      createdById: maker.id,
    });
    await syncAttachments(ctx, transaction, {
      kind: "CSV_EXPORT",
      owner: { csvExportId: created.id },
      ids: [attachmentId],
    });
    return created;
  });
  return { ...csvExport, url: await urlOf(ctx, csvExport.id) };
};

/** 履歴: the caller's downloads of one type, newest first. */
export const list = (
  ctx: RequestContext,
  query: ListCsvExportsQuery,
): Promise<PageResult<CsvExportListItem>> =>
  createCsvExportRepository(ctx.db).findPage(
    { page: query.page, perPage: query.perPage },
    { createdById: makerOf(ctx).id, type: query.type },
  );

/**
 * 履歴's ダウンロード: a new read URL for one of the caller's files. The file holds the entity's data,
 * so the grants to download it again are the grants to make it now.
 */
export const downloadUrl = async (
  ctx: RequestContext,
  csvExportId: string,
): Promise<CsvExportFile> => {
  const csvExport = await ownExport(ctx, csvExportId);
  assertMayExport(ctx, csvExport.type);
  return { ...csvExport, url: await urlOf(ctx, csvExport.id) };
};
