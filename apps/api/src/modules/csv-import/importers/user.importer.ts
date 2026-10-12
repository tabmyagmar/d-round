import { createUserRepository } from "@repo/database";
import { assignableRoles, inviteUserSchema, updateUserSchema } from "@repo/validation";
import { ROLE_BY_LABEL, userCreateCsv, userUpdateCsv } from "@repo/validation/csv";
import type { UserCsvRow } from "@repo/validation/csv";

import { ValidationError } from "../../../core/errors";
import * as userService from "../../user/user.service";
import { errorsByLine, uploaderOf } from "../csv-importer";
import type { CsvImporter } from "../csv-importer";

/**
 * 担当者 CSV rows go through the user service — `invite` (the invitation mail included, as
 * 担当者追加) and `update` — so every rule of the screens holds (legacy
 * `user-csv-upload-*` / `user-csv-update-*`, which wrote the tables directly).
 */

const profileOf = (row: UserCsvRow) => ({
  employeeNumber: row.employeeNumber,
  departmentName: row.departmentName,
  position: row.position,
  retirementDate: row.retirementDate,
  areas: row.areas,
  regionCodes: row.regionCodes,
});

const nameOf = (row: UserCsvRow) => ({
  lastName: row.lastName,
  firstName: row.firstName,
  lastNameKana: row.lastNameKana,
  firstNameKana: row.firstNameKana,
});

const labelOfRole = (role: string) =>
  Object.entries(ROLE_BY_LABEL).find(([, code]) => code === role)?.[0] ?? role;

const lower = (value: string) => value.toLowerCase();

export const userCreateImporter: CsvImporter<UserCsvRow> = {
  definition: userCreateCsv,

  check: async (ctx, rows) => {
    const users = createUserRepository(ctx.db);
    const [takenEmails, takenNumbers] = await Promise.all([
      users.findTakenEmails(rows.flatMap(({ row }) => (row.email ? [row.email] : []))),
      users.findTakenEmployeeNumbers(rows.map(({ row }) => row.employeeNumber)),
    ]);
    const emails = new Set(takenEmails.map(lower));
    const numbers = new Set(takenNumbers);
    const assignable: readonly string[] = assignableRoles(uploaderOf(ctx).role);
    const { errors, add } = errorsByLine();
    for (const { lineNumber, row } of rows) {
      if (row.email && emails.has(lower(row.email))) {
        add(lineNumber, `メールアドレス: ${row.email} 既に登録されています`);
      }
      if (numbers.has(row.employeeNumber)) {
        add(lineNumber, `社員番号: ${String(row.employeeNumber)} 既に登録されています`);
      }
      if (!assignable.includes(row.role)) {
        add(lineNumber, `アカウントタイプ: 「${labelOfRole(row.role)}」は登録できません`);
      }
    }
    return errors;
  },

  importRow: async (ctx, row) => {
    const input = inviteUserSchema.parse({
      email: row.email,
      ...nameOf(row),
      role: row.role,
      profile: profileOf(row),
    });
    return (await userService.invite(ctx, input)).id;
  },
};

/** The active 担当者 of a 社員番号, which an update row changes. */
const targetsOf = async (ctx: Parameters<CsvImporter<UserCsvRow>["check"]>[0], numbers: number[]) =>
  new Map(
    (await createUserRepository(ctx.db).findByEmployeeNumbers(numbers)).map((user) => [
      user.profile?.employeeNumber,
      user,
    ]),
  );

const notFound = (employeeNumber: number) =>
  `社員番号: ${String(employeeNumber)} の担当者が見つかりません`;

export const userUpdateImporter: CsvImporter<UserCsvRow> = {
  definition: userUpdateCsv,

  check: async (ctx, rows) => {
    const targets = await targetsOf(
      ctx,
      rows.map(({ row }) => row.employeeNumber),
    );
    const assignable: readonly string[] = assignableRoles(uploaderOf(ctx).role);
    const mayChangeRoles = ctx.ability.can("changeRole", "User");
    const { errors, add } = errorsByLine();
    for (const { lineNumber, row } of rows) {
      const target = targets.get(row.employeeNumber);
      if (!target) {
        add(lineNumber, notFound(row.employeeNumber));
        continue;
      }
      if (row.email && lower(row.email) !== lower(target.email)) {
        add(lineNumber, `メールアドレス: 変更できません（登録済み: ${target.email}）`);
      }
      if (row.role !== target.role && (!mayChangeRoles || !assignable.includes(row.role))) {
        add(lineNumber, `アカウントタイプ: 「${labelOfRole(row.role)}」に変更できません`);
      }
    }
    return errors;
  },

  importRow: async (ctx, row) => {
    const target = (await targetsOf(ctx, [row.employeeNumber])).get(row.employeeNumber);
    if (!target) {
      throw new ValidationError(notFound(row.employeeNumber));
    }
    const input = updateUserSchema.parse({
      userId: target.id,
      ...nameOf(row),
      role: row.role,
      profile: profileOf(row),
    });
    return (await userService.update(ctx, input)).id;
  },
};
