import { createSourceRepository, createStaffRepository } from "@repo/database";
import type { StaffDetailRow } from "@repo/database";
import { toIsoDay } from "@repo/dayjs";
import { createStaffSchema, formatPostCode, updateStaffSchema } from "@repo/validation";
import { staffCreateCsv, staffUpdateCsv } from "@repo/validation/csv";
import type { StaffCreateCsvRow, StaffCsvRow } from "@repo/validation/csv";

import type { RequestContext } from "../../../core/context";
import { ValidationError } from "../../../core/errors";
import * as staffService from "../../staff/staff.service";
import { errorsByLine } from "../csv-importer";
import type { CsvImporter } from "../csv-importer";

import { lookupChargers } from "./charger-lookup";

/**
 * スタッフ CSV rows go through the staff service — `create` and `update` — so the staff form's
 * rules hold (legacy `staff-csv-*`, which wrote the tables directly). An update changes what the
 * CSV carries and keeps the rest of the staff: its 在籍情報, 家族情報, メモ and 履歴書.
 */

/** The checks both types share: the post code in the master, each 担当者 an active user of the 地域. */
const checkReferences = async (
  ctx: RequestContext,
  rows: readonly { lineNumber: number; row: StaffCsvRow }[],
  add: (lineNumber: number, message: string) => void,
) => {
  const [known, chargers] = await Promise.all([
    createSourceRepository(ctx.db).findKnownPostCodes(rows.map(({ row }) => row.postCode)),
    lookupChargers(
      ctx,
      rows.flatMap(({ row }) => row.chargerEmails),
    ),
  ]);
  const postCodes = new Set(known);
  for (const { lineNumber, row } of rows) {
    if (!postCodes.has(row.postCode)) {
      add(lineNumber, `郵便番号: ${formatPostCode(row.postCode)} が見つかりません`);
    }
    for (const email of row.chargerEmails) {
      const charger = chargers.resolve(email, row.regionCodes);
      if ("error" in charger) {
        add(lineNumber, charger.error);
      }
    }
  }
};

/** The 担当者 of a row as user ids; an address that no longer fits refuses the row. */
const chargerIdsOf = async (ctx: RequestContext, row: StaffCsvRow): Promise<string[]> => {
  const chargers = await lookupChargers(ctx, row.chargerEmails);
  return row.chargerEmails.map((email) => {
    const charger = chargers.resolve(email, row.regionCodes);
    if ("error" in charger) {
      throw new ValidationError(charger.error);
    }
    return charger.id;
  });
};

/** The staff fields a CSV row carries, as the staff input names them. */
const fieldsOf = (row: StaffCsvRow, chargerUserIds: string[]) => ({
  employeeType: row.employeeType,
  employeeNumber: row.employeeNumber,
  lastName: row.lastName,
  firstName: row.firstName,
  lastNameKana: row.lastNameKana,
  firstNameKana: row.firstNameKana,
  gender: row.gender,
  birthday: row.birthday,
  position: row.position,
  branchName: row.branchName,
  email: row.email,
  phoneNumber: row.phoneNumber,
  emergencyPhoneNumber: row.emergencyPhoneNumber,
  areas: row.areas,
  regionCodes: row.regionCodes,
  prefectureCodes: row.prefectureCodes,
  chargerUserIds,
  address: { postCode: row.postCode, address1: row.address1 },
});

const notFound = (employeeNumber: number) =>
  `スタッフ番号: ${String(employeeNumber)} のスタッフが見つかりません`;

export const staffCreateImporter: CsvImporter<StaffCreateCsvRow> = {
  definition: staffCreateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const taken = new Set(
      (
        await createStaffRepository(ctx.db).findActiveByEmployeeNumbers(
          rows.map(({ row }) => row.employeeNumber),
        )
      ).map((staff) => staff.employeeNumber),
    );
    for (const { lineNumber, row } of rows) {
      if (taken.has(row.employeeNumber)) {
        add(lineNumber, `スタッフ番号: ${String(row.employeeNumber)} 既に登録されています`);
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const input = createStaffSchema.parse({
      ...fieldsOf(row, await chargerIdsOf(ctx, row)),
      jobHistories: [
        {
          hireDate: row.hireDate,
          resignationDate: row.resignationDate,
          resignationReason: row.resignationReason,
        },
      ],
      familyMembers: [],
      memos: [],
    });
    return (await staffService.create(ctx, input)).id;
  },
};

/** What an update keeps of the staff, in the input's shape (as the edit screen sends it). */
const keptListsOf = (staff: StaffDetailRow) => ({
  jobHistories: staff.jobHistories.map((job) => ({
    hireDate: toIsoDay(job.hireDate),
    resignationDate: job.resignationDate ? toIsoDay(job.resignationDate) : null,
    resignationReason: job.resignationReason,
  })),
  familyMembers: staff.familyMembers.map((member) => ({
    lastName: member.lastName,
    firstName: member.firstName,
    lastNameKana: member.lastNameKana,
    firstNameKana: member.firstNameKana,
    relation: member.relation,
    birthday: member.birthday ? toIsoDay(member.birthday) : null,
  })),
  memos: staff.memos.map((memo) => ({ memoType: memo.memoType, content: memo.content })),
});

export const staffUpdateImporter: CsvImporter<StaffCsvRow> = {
  definition: staffUpdateCsv,

  check: async (ctx, rows) => {
    const { errors, add } = errorsByLine();
    const found = new Set(
      (
        await createStaffRepository(ctx.db).findActiveByEmployeeNumbers(
          rows.map(({ row }) => row.employeeNumber),
        )
      ).map((staff) => staff.employeeNumber),
    );
    for (const { lineNumber, row } of rows) {
      if (!found.has(row.employeeNumber)) {
        add(lineNumber, notFound(row.employeeNumber));
      }
    }
    await checkReferences(ctx, rows, add);
    return errors;
  },

  importRow: async (ctx, row) => {
    const staffs = createStaffRepository(ctx.db);
    const [target] = await staffs.findActiveByEmployeeNumbers([row.employeeNumber]);
    const current = target ? await staffs.findById(target.id) : null;
    if (!current) {
      throw new ValidationError(notFound(row.employeeNumber));
    }
    const input = updateStaffSchema.parse({
      staffId: current.id,
      ...fieldsOf(row, await chargerIdsOf(ctx, row)),
      ...keptListsOf(current),
    });
    return (await staffService.update(ctx, input)).id;
  },
};
