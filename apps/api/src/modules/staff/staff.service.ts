import {
  createSourceRepository,
  createStaffRepository,
  createUserRepository,
  withTransaction,
} from "@repo/database";
import type {
  ChargedStaffRow,
  DbClient,
  PageResult,
  Prisma,
  StaffDetailRow,
  StaffListRow,
  StaffWrite,
} from "@repo/database";
import { accessibleStaffWhere, prismaStaffSubject } from "@repo/permissions/server";
import { employeeNumberOfSearch } from "@repo/validation";
import type {
  ChangeStaffStatusInput,
  CreateStaffInput,
  DeleteStaffsInput,
  ListStaffsQuery,
  Role,
  SortOrder,
  StaffNumberAvailableInput,
  StaffSortField,
  StaffStatus,
  UpdateStaffInput,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";

/**
 * スタッフ (ADR 0008). The router checked the catalog action on the type; this service checks the
 * row (`prismaStaffSubject` for one staff, `accessibleStaffWhere` for lists and deletes — no row
 * rule today, so the answer equals the type's), the スタッフ番号 among non-deleted staff, the
 * reference data and the 担当者, and writes a staff and its lists in one transaction.
 */

type StaffAction = "create" | "read" | "update" | "delete" | "status";

const assertMay = (ctx: RequestContext, action: StaffAction): void => {
  if (!ctx.ability.can(action, "Staff")) {
    throw new ForbiddenError(`Not allowed to ${action} staff`);
  }
};

const assertCanRow = (ctx: RequestContext, action: StaffAction, staff: StaffDetailRow): void => {
  if (!ctx.ability.can(action, prismaStaffSubject(staff))) {
    throw new ForbiddenError(`Not allowed to ${action} this staff`);
  }
};

const loadStaff = async (db: DbClient, staffId: string): Promise<StaffDetailRow> => {
  const staff = await createStaffRepository(db).findById(staffId);
  if (!staff) {
    throw new NotFoundError("Staff", staffId);
  }
  return staff;
};

/** The allow-listed sort columns (`STAFF_SORT_FIELDS`) as Prisma orderings (legacy: name = 姓, 名). */
const STAFF_ORDER_BY: Record<
  StaffSortField,
  (direction: SortOrder) => Prisma.StaffOrderByWithRelationInput[]
> = {
  employeeNumber: (direction) => [{ employeeNumber: direction }],
  name: (direction) => [{ lastName: direction }, { firstName: direction }],
  createdAt: (direction) => [{ createdAt: direction }],
};

const SUSPENDED: StaffStatus = "SUSPENDED";

export const list = async (
  ctx: RequestContext,
  query: ListStaffsQuery,
): Promise<PageResult<StaffListRow>> => {
  assertMay(ctx, "read");
  const filters: Prisma.StaffWhereInput[] = [
    accessibleStaffWhere(ctx.ability, "read"),
    // Without a status filter, every staff but the 停止 ones (legacy `status not DELETE`).
    query.statuses?.length ? { status: { in: query.statuses } } : { status: { not: SUSPENDED } },
  ];
  if (query.search) {
    const employeeNumber = employeeNumberOfSearch(query.search);
    filters.push({
      OR: [
        ...(employeeNumber === null ? [] : [{ employeeNumber }]),
        { lastName: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastNameKana: { contains: query.search } },
        { firstNameKana: { contains: query.search } },
      ],
    });
  }
  if (query.genders?.length) {
    filters.push({ gender: { in: query.genders } });
  }
  if (query.areas?.length) {
    filters.push({ areas: { hasSome: query.areas } });
  }
  if (query.regionCodes?.length) {
    filters.push({ regions: { some: { regionCode: { in: query.regionCodes } } } });
  }
  if (query.prefectureCodes?.length) {
    filters.push({ prefectures: { some: { prefectureCode: { in: query.prefectureCodes } } } });
  }
  if (query.employeeTypes?.length) {
    filters.push({ employeeType: { in: query.employeeTypes } });
  }
  return createStaffRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
    STAFF_ORDER_BY[query.sortBy](query.sortOrder),
  );
};

export const getById = async (ctx: RequestContext, staffId: string): Promise<StaffDetailRow> => {
  assertMay(ctx, "read");
  const staff = await loadStaff(ctx.db, staffId);
  assertCanRow(ctx, "read", staff);
  return staff;
};

/** A calendar date as stored in a DATE column: UTC midnight of that day. */
const dateOf = (isoDate: string): Date => new Date(isoDate);

const STAFF_NUMBER_TAKEN = "This staff number is already in use";

/**
 * What a write needs beyond its schema: the スタッフ番号 free among non-deleted staff, the regions,
 * prefectures and post code known. The 担当者 are checked apart (`assertChargersActive`).
 */
const assertWritable = async (
  db: DbClient,
  input: CreateStaffInput,
  staffId?: string,
): Promise<void> => {
  const holders = await createStaffRepository(db).countActiveByEmployeeNumber(
    input.employeeNumber,
    staffId,
  );
  if (holders > 0) {
    throw new ConflictError(STAFF_NUMBER_TAKEN);
  }
  const source = createSourceRepository(db);
  const regions = new Set((await source.findRegions()).map((region) => region.code));
  const prefectures = new Set((await source.findPrefectures()).map((item) => item.code));
  const unknown = [
    ...input.regionCodes
      .filter((code) => !regions.has(code))
      .map((code) => `region ${String(code)}`),
    ...input.prefectureCodes
      .filter((code) => !prefectures.has(code))
      .map((code) => `prefecture ${String(code)}`),
  ];
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown ${unknown.join(", ")}`);
  }
  if (!(await source.findAddressByPostCode(input.address.postCode))) {
    throw new ValidationError(`Unknown post code ${input.address.postCode}`);
  }
};

/**
 * A 担当者 being assigned must be an active user other than a super_admin. Only new ones are
 * asked: one deactivated since keeps the history row, and the staff stays editable.
 */
const assertChargersActive = async (db: DbClient, userIds: readonly string[]): Promise<void> => {
  if (userIds.length === 0) {
    return;
  }
  const superAdmin: Role = "super_admin";
  const chargers = await createUserRepository(db).findChargerOptions(
    { id: { in: [...userIds] }, role: { not: superAdmin } },
    userIds.length,
  );
  if (chargers.length !== userIds.length) {
    throw new ValidationError("Every 担当者 must be an active user");
  }
};

/** The parsed form as the repository writes it; memos without text are not stored. */
const toWrite = (input: CreateStaffInput): StaffWrite => ({
  fields: {
    employeeType: input.employeeType,
    employeeNumber: input.employeeNumber,
    lastName: input.lastName,
    firstName: input.firstName,
    lastNameKana: input.lastNameKana,
    firstNameKana: input.firstNameKana,
    gender: input.gender,
    birthday: dateOf(input.birthday),
    position: input.position,
    branchName: input.branchName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    emergencyPhoneNumber: input.emergencyPhoneNumber,
    areas: input.areas,
  },
  address: input.address,
  regionCodes: input.regionCodes,
  prefectureCodes: input.prefectureCodes,
  chargerUserIds: input.chargerUserIds,
  familyMembers: input.familyMembers.map((member) => ({
    ...member,
    birthday: member.birthday === null ? null : dateOf(member.birthday),
  })),
  memos: input.memos.filter((memo) => memo.content.trim() !== ""),
  jobHistories: input.jobHistories.map((job) => ({
    hireDate: dateOf(job.hireDate),
    resignationDate: job.resignationDate === null ? null : dateOf(job.resignationDate),
    resignationReason: job.resignationReason,
  })),
});

/** スタッフ追加 (catalog row 1301): the staff and everything of it in one transaction. */
export const create = async (
  ctx: RequestContext,
  input: CreateStaffInput,
): Promise<StaffDetailRow> => {
  assertMay(ctx, "create");
  return withTransaction(ctx.db, async ({ tx }) => {
    await assertWritable(tx, input);
    await assertChargersActive(tx, input.chargerUserIds);
    const { id } = await createStaffRepository(tx).create(toWrite(input));
    return loadStaff(tx, id);
  });
};

/**
 * スタッフ情報編集 (row 1303): the fields and address, the code sets and lists replaced, and the
 * 担当者 moved — the removed ones closed (their history stays), the new ones added and checked.
 */
export const update = async (
  ctx: RequestContext,
  input: UpdateStaffInput,
): Promise<StaffDetailRow> => {
  assertMay(ctx, "update");
  return withTransaction(ctx.db, async ({ tx }) => {
    const staffs = createStaffRepository(tx);
    const current = await loadStaff(tx, input.staffId);
    assertCanRow(ctx, "update", current);
    await assertWritable(tx, input, current.id);
    const write = toWrite(input);
    const before = await staffs.findCurrentChargerIds(current.id);
    const removed = before.filter((userId) => !write.chargerUserIds.includes(userId));
    const added = write.chargerUserIds.filter((userId) => !before.includes(userId));
    await assertChargersActive(tx, added);
    await staffs.updateFields(current.id, write.fields, write.address);
    await staffs.replaceRegions(current.id, write.regionCodes);
    await staffs.replacePrefectures(current.id, write.prefectureCodes);
    await staffs.replaceFamilyMembers(current.id, write.familyMembers);
    await staffs.replaceMemos(current.id, write.memos);
    await staffs.replaceJobHistories(current.id, write.jobHistories);
    if (removed.length > 0) {
      await staffs.closeChargers(current.id, removed);
    }
    if (added.length > 0) {
      await staffs.addChargers(current.id, added);
    }
    return loadStaff(tx, current.id);
  });
};

/** ステータス変更 (row 1305); the same status is a no-op. */
export const changeStatus = async (
  ctx: RequestContext,
  input: ChangeStaffStatusInput,
): Promise<{ id: string; status: StaffStatus }> => {
  assertMay(ctx, "status");
  const staff = await loadStaff(ctx.db, input.staffId);
  assertCanRow(ctx, "status", staff);
  if (staff.status === input.status) {
    return { id: staff.id, status: staff.status };
  }
  return createStaffRepository(ctx.db).updateStatus(staff.id, input.status);
};

/**
 * スタッフ削除 (row 1304): every one of them must be a staff the caller may delete and be 停止
 * (legacy rule, `deleteStaffs where status DELETE`); soft delete.
 */
export const removeMany = async (
  ctx: RequestContext,
  input: DeleteStaffsInput,
): Promise<{ count: number }> => {
  assertMay(ctx, "delete");
  return withTransaction(ctx.db, async ({ tx }) => {
    const staffs = createStaffRepository(tx);
    const ids = [...new Set(input.staffIds)];
    const rows = await staffs.findStatuses(ids, accessibleStaffWhere(ctx.ability, "delete"));
    if (rows.length !== ids.length) {
      throw new NotFoundError("Staff");
    }
    if (rows.some((row) => row.status !== SUSPENDED)) {
      throw new ConflictError("Only suspended staff can be deleted");
    }
    return { count: await staffs.softDeleteMany(ids) };
  });
};

/** Whether no other non-deleted staff holds the スタッフ番号 (legacy staffNumberExists). */
export const isEmployeeNumberAvailable = async (
  ctx: RequestContext,
  input: StaffNumberAvailableInput,
): Promise<boolean> => {
  if (!ctx.ability.can("create", "Staff") && !ctx.ability.can("update", "Staff")) {
    throw new ForbiddenError("Not allowed to create or update staff");
  }
  const holders = await createStaffRepository(ctx.db).countActiveByEmployeeNumber(
    input.employeeNumber,
    input.excludeStaffId,
  );
  return holders === 0;
};

/** The staff a user is currently 担当者 of (the user detail's 担当スタッフ, legacy userStaffs). */
export const listByCharger = async (
  ctx: RequestContext,
  userId: string,
): Promise<ChargedStaffRow[]> => {
  assertMay(ctx, "read");
  return createStaffRepository(ctx.db).findManyByCharger(
    userId,
    accessibleStaffWhere(ctx.ability, "read"),
  );
};
