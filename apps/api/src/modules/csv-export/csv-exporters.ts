import type {
  BranchRow,
  ClientDetailRow,
  StaffDetailRow,
  StaffFamilyMember,
  UserWithProfile,
} from "@repo/database";
import { dayjs } from "@repo/dayjs";
import type {
  BranchExportField,
  ClientExportField,
  CsvExportField,
  StaffExportField,
  UserExportField,
} from "@repo/validation";
import {
  AREA_BY_LABEL,
  EMPLOYEE_TYPE_BY_LABEL,
  FAMILY_RELATION_BY_LABEL,
  GENDER_BY_LABEL,
  ORDER_TYPE_BY_LABEL,
  POSITION_BY_LABEL,
  STATUS_BY_LABEL,
  USER_STATUS_BY_LABEL,
  labelOf,
} from "@repo/validation/csv";

import type { CsvSheetColumn } from "./csv-workbook";

/**
 * The cells of a ダウンロード per type and column (the legacy `getCellValue` over
 * `csvDownloadFields`): labels instead of codes, lists joined with ",", days as `YYYY/MM/DD`, and ""
 * for nothing.
 */

type Cells<K extends string, Row> = Record<K, (row: Row) => string>;

/** The picked columns of `fields` with their cells, in the file's order. */
export const columnsOf = <K extends string, Row>(
  fields: readonly CsvExportField<K>[],
  picked: readonly K[],
  cells: Cells<K, Row>,
): CsvSheetColumn<Row>[] =>
  fields
    .filter((field) => picked.includes(field.key))
    .map((field) => ({ header: field.header, cell: cells[field.key] }));

const textOf = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/** A DATE column's day: midnight UTC. The audit log's views write days the same way. */
export const dayOf = (date: Date | null | undefined): string =>
  date ? dayjs.utc(date).format("YYYY/MM/DD") : "";

const listOf = (items: readonly string[]): string => items.join(",");

/** 住所（県・市）: the post code's part of an address (the legacy address1). */
const prefCityOf = (
  address: { sourceAddress: { pref: string; city: string; town: string } } | null,
): string =>
  address
    ? `${address.sourceAddress.pref}${address.sourceAddress.city}${address.sourceAddress.town}`
    : "";

export const USER_CELLS: Cells<UserExportField, UserWithProfile> = {
  employeeNumber: (user) => textOf(user.profile?.employeeNumber),
  lastName: (user) => textOf(user.lastName),
  firstName: (user) => textOf(user.firstName),
  lastNameKana: (user) => textOf(user.lastNameKana),
  firstNameKana: (user) => textOf(user.firstNameKana),
  areas: (user) => listOf((user.profile?.areas ?? []).map((area) => labelOf(AREA_BY_LABEL, area))),
  regions: (user) => listOf((user.profile?.regions ?? []).map((row) => row.region.name)),
  departmentName: (user) => textOf(user.profile?.departmentName),
  position: (user) => (user.profile ? labelOf(POSITION_BY_LABEL, user.profile.position) : ""),
  email: (user) => user.email,
  retirementDate: (user) => dayOf(user.profile?.retirementDate),
  status: (user) => labelOf(USER_STATUS_BY_LABEL, user.deletedAt ? "deactivated" : "active"),
};

/** The latest 在籍情報: the form adds a period at the end (the legacy took the newest row). */
const latestJobOf = (staff: StaffDetailRow) => staff.jobHistories.at(-1);

export const STAFF_CELLS: Cells<StaffExportField, StaffDetailRow> = {
  employeeType: (staff) => labelOf(EMPLOYEE_TYPE_BY_LABEL, staff.employeeType),
  employeeNumber: (staff) => String(staff.employeeNumber),
  lastName: (staff) => staff.lastName,
  firstName: (staff) => staff.firstName,
  lastNameKana: (staff) => staff.lastNameKana,
  firstNameKana: (staff) => staff.firstNameKana,
  areas: (staff) => listOf(staff.areas.map((area) => labelOf(AREA_BY_LABEL, area))),
  regions: (staff) => listOf(staff.regions.map((row) => row.region.name)),
  prefectures: (staff) => listOf(staff.prefectures.map((row) => row.prefecture.name)),
  // The current 担当者: the detail's list keeps the unassigned ones too.
  chargers: (staff) =>
    listOf(staff.chargers.filter((row) => row.unassignedAt === null).map((row) => row.user.name)),
  branchName: (staff) => textOf(staff.branchName),
  position: (staff) => (staff.position ? labelOf(POSITION_BY_LABEL, staff.position) : ""),
  birthday: (staff) => dayOf(staff.birthday),
  gender: (staff) => labelOf(GENDER_BY_LABEL, staff.gender),
  postCode: (staff) => textOf(staff.address?.postCode),
  prefCity: (staff) => prefCityOf(staff.address),
  address1: (staff) => textOf(staff.address?.address1),
  phoneNumber: (staff) => textOf(staff.phoneNumber),
  emergencyPhoneNumber: (staff) => textOf(staff.emergencyPhoneNumber),
  email: (staff) => textOf(staff.email),
  hireDate: (staff) => dayOf(latestJobOf(staff)?.hireDate),
  resignationDate: (staff) => dayOf(latestJobOf(staff)?.resignationDate),
  resignationReason: (staff) => textOf(latestJobOf(staff)?.resignationReason),
  status: (staff) => labelOf(STATUS_BY_LABEL, staff.status),
};

/** A 家族情報 row: the member with its staff's スタッフ番号. */
export type FamilyMemberRow = StaffFamilyMember & { employeeNumber: number };

/** The 家族情報 sheet, all its columns always (legacy `familyMemberFields`). */
export const FAMILY_COLUMNS: CsvSheetColumn<FamilyMemberRow>[] = [
  { header: "スタッフ番号", cell: (member) => String(member.employeeNumber) },
  { header: "姓", cell: (member) => member.lastName },
  { header: "名", cell: (member) => member.firstName },
  { header: "セイ", cell: (member) => textOf(member.lastNameKana) },
  { header: "メイ", cell: (member) => textOf(member.firstNameKana) },
  {
    header: "続柄",
    cell: (member) => (member.relation ? labelOf(FAMILY_RELATION_BY_LABEL, member.relation) : ""),
  },
  { header: "生年月日", cell: (member) => dayOf(member.birthday) },
];

export const CLIENT_CELLS: Cells<ClientExportField, ClientDetailRow> = {
  number: (client) => String(client.number),
  name: (client) => client.name,
  nameKana: (client) => client.nameKana,
  areas: (client) => listOf(client.areas.map((area) => labelOf(AREA_BY_LABEL, area))),
  regions: (client) => listOf(client.regions.map((row) => row.region.name)),
  chargers: (client) => listOf(client.chargers.map((row) => row.user.name)),
  postCode: (client) => textOf(client.address?.postCode),
  prefCity: (client) => prefCityOf(client.address),
  address1: (client) => textOf(client.address?.address1),
  phoneNumber: (client) => client.phoneNumber,
  fax: (client) => textOf(client.fax),
  webUrl: (client) => textOf(client.webUrl),
  orderTypes: (client) =>
    listOf(client.orderTypes.map((type) => labelOf(ORDER_TYPE_BY_LABEL, type))),
  status: (client) => labelOf(STATUS_BY_LABEL, client.status),
};

/** A 就業先部署情報 sheet starts with the branch's client (legacy `branchFieldsWithClient`). */
export const BRANCH_CLIENT_COLUMNS: CsvSheetColumn<BranchRow>[] = [
  { header: "クライアント番号", cell: (branch) => String(branch.client.number) },
  { header: "クライアント名", cell: (branch) => branch.client.name },
];

export const BRANCH_CELLS: Cells<BranchExportField, BranchRow> = {
  number: (branch) => String(branch.number),
  name: (branch) => branch.name,
  nameKana: (branch) => branch.nameKana,
  departmentNumber: (branch) => String(branch.departmentNumber),
  departmentName: (branch) => branch.departmentName,
  departmentNameKana: (branch) => branch.departmentNameKana,
  area: (branch) => labelOf(AREA_BY_LABEL, branch.area),
  region: (branch) => branch.region.name,
  chargers: (branch) => listOf(branch.chargers.map((row) => row.user.name)),
  departmentFax: (branch) => textOf(branch.departmentFax),
  postCode: (branch) => textOf(branch.address?.postCode),
  prefCity: (branch) => prefCityOf(branch.address),
  address1: (branch) => textOf(branch.address?.address1),
  status: (branch) => labelOf(STATUS_BY_LABEL, branch.status),
  contactLastName: (branch) => branch.contactLastName,
  contactFirstName: (branch) => branch.contactFirstName,
  contactLastNameKana: (branch) => branch.contactLastNameKana,
  contactFirstNameKana: (branch) => branch.contactFirstNameKana,
  contactPosition: (branch) => labelOf(POSITION_BY_LABEL, branch.contactPosition),
  contactEmail: (branch) => branch.contactEmail,
};
