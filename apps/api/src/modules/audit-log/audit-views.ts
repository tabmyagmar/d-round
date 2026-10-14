import type {
  BranchRow,
  ClientDetailRow,
  StaffDetailRow,
  UserPermissionOverride,
  UserWithProfile,
} from "@repo/database";
import {
  AUDIT_ENTITY_TYPES,
  BRANCH_EXPORT_FIELDS,
  CLIENT_EXPORT_FIELDS,
  ROLE_LABELS,
  STAFF_EXPORT_FIELDS,
  STAFF_MEMO_TYPE_LABELS,
  USER_EXPORT_FIELDS,
  roleSchema,
} from "@repo/validation";
import type { AuditEntityType, CsvExportType, CsvImportType } from "@repo/validation";

import {
  BRANCH_CELLS,
  CLIENT_CELLS,
  FAMILY_COLUMNS,
  STAFF_CELLS,
  USER_CELLS,
  dayOf,
} from "../csv-export/csv-exporters";

import type { AuditView } from "./audit-log.service";

/**
 * Each entity's audit view (docs/adr/0015-audit-log.md): the CSV download's cells for its columns —
 * labels instead of codes, names instead of ids, `YYYY/MM/DD` days — then the fields a form changes
 * that a download leaves out. `AUDIT_FIELDS` (@repo/validation) lists the same keys in the same
 * order, with their labels.
 */

/** Joins a list of compound entries (a period, a family member, a memo). */
const ENTRY_SEPARATOR = " / ";

const cellsOf = <K extends string, Row>(
  fields: readonly { key: K }[],
  cells: Record<K, (row: Row) => string>,
  row: Row,
): Record<K, string> =>
  Object.fromEntries(fields.map(({ key }) => [key, cells[key](row)])) as Record<K, string>;

const roleLabelOf = (role: string): string => {
  const known = roleSchema.safeParse(role);
  return known.success ? ROLE_LABELS[known.data] : role;
};

/**
 * A 担当者: the download's columns, the アカウントタイプ and the 権限設定 — the user's own
 * overrides (`＋` adds a permission to the role's, `－` removes one), named from the catalog.
 */
export const userAuditView = (
  user: UserWithProfile,
  overrides: readonly UserPermissionOverride[],
  permissionNames: ReadonlyMap<string, string>,
): AuditView => ({
  ...cellsOf(USER_EXPORT_FIELDS, USER_CELLS, user),
  role: roleLabelOf(user.role),
  permissions: overrides
    .map(
      ({ permissionKey, effect }) =>
        `${effect === "ALLOW" ? "＋" : "－"}${permissionNames.get(permissionKey) ?? permissionKey}`,
    )
    .join(","),
});

/**
 * A スタッフ: the download's columns, then every 在籍情報 period, the 家族情報 (as the download's
 * family sheet writes a member), the メモ with their titles and the 履歴書 file names.
 */
export const staffAuditView = (staff: StaffDetailRow, resumes: readonly string[]): AuditView => ({
  ...cellsOf(STAFF_EXPORT_FIELDS, STAFF_CELLS, staff),
  jobHistories: staff.jobHistories
    .map(
      (job) =>
        `${dayOf(job.hireDate)}〜${dayOf(job.resignationDate)}${job.resignationReason ? ` ${job.resignationReason}` : ""}`,
    )
    .join(ENTRY_SEPARATOR),
  familyMembers: staff.familyMembers
    .map((member) =>
      FAMILY_COLUMNS.slice(1)
        .map((column) => column.cell({ ...member, employeeNumber: staff.employeeNumber }))
        .filter((cell) => cell !== "")
        .join(" "),
    )
    .join(ENTRY_SEPARATOR),
  memos: staff.memos
    .map((memo) => `${STAFF_MEMO_TYPE_LABELS[memo.memoType]}: ${memo.content}`)
    .join(ENTRY_SEPARATOR),
  resumes: resumes.join(","),
});

export const clientAuditView = (client: ClientDetailRow): AuditView =>
  cellsOf(CLIENT_EXPORT_FIELDS, CLIENT_CELLS, client);

/** A 就業先部署: the download's columns, then its メモ. */
export const branchAuditView = (branch: BranchRow): AuditView => ({
  ...cellsOf(BRANCH_EXPORT_FIELDS, BRANCH_CELLS, branch),
  memo: branch.memo ?? "",
});

/** What a row calls its target, as the lists show it: the number, then the name. */
export const userLabelOf = (user: {
  name: string;
  profile: { employeeNumber: number } | null;
}): string => (user.profile ? `${String(user.profile.employeeNumber)} ${user.name}` : user.name);

export const staffLabelOf = (staff: {
  employeeNumber: number;
  lastName: string;
  firstName: string;
}): string => `${String(staff.employeeNumber)} ${staff.lastName} ${staff.firstName}`;

export const clientLabelOf = (client: { number: number; name: string }): string =>
  `${String(client.number)} ${client.name}`;

export const branchLabelOf = (branch: {
  number: number;
  name: string;
  client: { number: number };
}): string => `${String(branch.client.number)}-${String(branch.number)} ${branch.name}`;

/** The entity a CSV download is of. */
const CSV_EXPORT_ENTITIES: Record<CsvExportType, AuditEntityType> = {
  USER: "User",
  STAFF: "Staff",
  CLIENT: "Client",
  BRANCH: "Branch",
};

/** What a CSV import does, to which entity. */
const CSV_IMPORT_KINDS: Record<CsvImportType, readonly [CsvExportType, string]> = {
  USER_CREATE: ["USER", "追加"],
  USER_UPDATE: ["USER", "更新"],
  STAFF_CREATE: ["STAFF", "追加"],
  STAFF_UPDATE: ["STAFF", "更新"],
  CLIENT_CREATE: ["CLIENT", "追加"],
  CLIENT_UPDATE: ["CLIENT", "更新"],
  BRANCH_CREATE: ["BRANCH", "追加"],
  BRANCH_UPDATE: ["BRANCH", "更新"],
};

/** A CSV download's type in words: the entity's name (`STAFF` → スタッフ). */
export const csvExportTypeLabelOf = (type: CsvExportType): string =>
  AUDIT_ENTITY_TYPES[CSV_EXPORT_ENTITIES[type]];

/** A CSV import's type in words: the entity's name and what it does (`STAFF_UPDATE` → スタッフ 更新). */
export const csvImportTypeLabelOf = (type: CsvImportType): string => {
  const [entity, verb] = CSV_IMPORT_KINDS[type];
  return `${csvExportTypeLabelOf(entity)} ${verb}`;
};
