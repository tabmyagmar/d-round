import { createAttachmentRepository, createStaffRepository, withTransaction } from "@repo/database";
import type {
  ChargedStaffRow,
  DbClient,
  PageResult,
  Prisma,
  StaffDetailRow,
  StaffListRow,
  StaffWrite,
} from "@repo/database";
import { fromIsoDay } from "@repo/dayjs";
import { accessibleStaffWhere, prismaStaffSubject } from "@repo/permissions/server";
import { employeeNumberOfSearch, maskedAuditFields } from "@repo/validation";
import type {
  AuditAction,
  AuditChange,
  ChangeStaffStatusInput,
  CreateStaffInput,
  DeleteStaffsInput,
  ListStaffsQuery,
  SortOrder,
  StaffNumberAvailableInput,
  StaffSortField,
  StaffStatus,
  UpdateStaffInput,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";
import { assertUploaded, syncAttachments, viewsOf } from "../attachment/attachment.service";
import type { AttachmentView } from "../attachment/attachment.service";
import { diffViews, recordChanges } from "../audit-log/audit-log.service";
import type { AuditEntry } from "../audit-log/audit-log.service";
import { staffAuditView, staffLabelOf } from "../audit-log/audit-views";
import { assertKnownSource } from "../source/source.service";
import { assertChargersActive } from "../user/user.service";

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

const STAFF_MASKED_FIELDS = maskedAuditFields("Staff");

/** The audit log's row for a write to one スタッフ (docs/adr/0015-audit-log.md). */
const staffAuditEntry = (
  action: AuditAction,
  staff: { id: string; employeeNumber: number; lastName: string; firstName: string },
  changes: AuditChange[],
): AuditEntry => ({
  action,
  entityType: "Staff",
  entityId: staff.id,
  entityLabel: staffLabelOf(staff),
  changes,
});

/** The 履歴書 file names a staff holds in `db` now, for its audit view. */
const resumeNamesIn = async (db: DbClient, staffId: string): Promise<string[]> =>
  (await createAttachmentRepository(db).findAttached({ staffId }, "STAFF_RESUME")).map(
    (file) => file.fileName,
  );

/** A staff as the detail and edit screens need it, with the 履歴書 files and their read URLs. */
export type StaffDetail = StaffDetailRow & { resumes: AttachmentView[] };

/** Read after the write committed, so new files are the ones signed (ADR 0012). */
const withResumes = async (ctx: RequestContext, staff: StaffDetailRow): Promise<StaffDetail> => ({
  ...staff,
  resumes: await viewsOf(ctx, { kind: "STAFF_RESUME", owner: { staffId: staff.id } }),
});

export const getById = async (ctx: RequestContext, staffId: string): Promise<StaffDetail> => {
  assertMay(ctx, "read");
  const staff = await loadStaff(ctx.db, staffId);
  assertCanRow(ctx, "read", staff);
  return withResumes(ctx, staff);
};

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
  await assertKnownSource(db, {
    regionCodes: input.regionCodes,
    prefectureCodes: input.prefectureCodes,
    postCode: input.address.postCode,
  });
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
    birthday: fromIsoDay(input.birthday),
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
    birthday: member.birthday === null ? null : fromIsoDay(member.birthday),
  })),
  memos: input.memos.filter((memo) => memo.content.trim() !== ""),
  jobHistories: input.jobHistories.map((job) => ({
    hireDate: fromIsoDay(job.hireDate),
    resignationDate: job.resignationDate === null ? null : fromIsoDay(job.resignationDate),
    resignationReason: job.resignationReason,
  })),
});

/** スタッフ追加 (catalog row 1301): the staff and everything of it, 履歴書 included, in one transaction. */
export const create = async (
  ctx: RequestContext,
  input: CreateStaffInput,
): Promise<StaffDetail> => {
  assertMay(ctx, "create");
  const resumeIds = input.resumeIds ?? [];
  await assertUploaded(ctx, "STAFF_RESUME", resumeIds);
  const created = await withTransaction(ctx.db, async (txc) => {
    const { tx } = txc;
    await assertWritable(tx, input);
    await assertChargersActive(tx, input.chargerUserIds);
    const { id } = await createStaffRepository(tx).create(toWrite(input));
    await syncAttachments(ctx, txc, {
      kind: "STAFF_RESUME",
      owner: { staffId: id },
      ids: resumeIds,
    });
    const created = await loadStaff(tx, id);
    const after = staffAuditView(created, await resumeNamesIn(tx, id));
    await recordChanges(ctx, tx, [
      staffAuditEntry("staff.create", created, diffViews(null, after, STAFF_MASKED_FIELDS)),
    ]);
    return created;
  });
  return withResumes(ctx, created);
};

/**
 * スタッフ情報編集 (row 1303): the fields and address, the code sets and lists replaced, and the
 * 担当者 moved — the removed ones closed (their history stays), the new ones added and checked —,
 * and, when `resumeIds` is given, the 履歴書 files made those (dropped files are deleted after
 * commit).
 */
export const update = async (
  ctx: RequestContext,
  input: UpdateStaffInput,
): Promise<StaffDetail> => {
  assertMay(ctx, "update");
  const owner = { staffId: input.staffId };
  const { resumeIds } = input;
  if (resumeIds !== undefined) {
    await assertUploaded(ctx, "STAFF_RESUME", resumeIds, owner);
  }
  const updated = await withTransaction(ctx.db, async (txc) => {
    const { tx } = txc;
    const staffs = createStaffRepository(tx);
    const current = await loadStaff(tx, input.staffId);
    assertCanRow(ctx, "update", current);
    const beforeView = staffAuditView(current, await resumeNamesIn(tx, current.id));
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
    if (resumeIds !== undefined) {
      await syncAttachments(ctx, txc, { kind: "STAFF_RESUME", owner, ids: resumeIds });
    }
    const saved = await loadStaff(tx, current.id);
    const afterView = staffAuditView(saved, await resumeNamesIn(tx, current.id));
    await recordChanges(ctx, tx, [
      staffAuditEntry("staff.update", saved, diffViews(beforeView, afterView, STAFF_MASKED_FIELDS)),
    ]);
    return saved;
  });
  return withResumes(ctx, updated);
};

/** ステータス変更 (row 1305); the same status is a no-op. */
export const changeStatus = async (
  ctx: RequestContext,
  input: ChangeStaffStatusInput,
): Promise<{ id: string; status: StaffStatus }> => {
  assertMay(ctx, "status");
  return withTransaction(ctx.db, async ({ tx }) => {
    const staff = await loadStaff(tx, input.staffId);
    assertCanRow(ctx, "status", staff);
    // Only the ステータス can differ, so the views leave the 履歴書 out on both sides.
    const changed = { ...staff, status: input.status };
    await recordChanges(ctx, tx, [
      staffAuditEntry(
        "staff.changeStatus",
        staff,
        diffViews(staffAuditView(staff, []), staffAuditView(changed, []), STAFF_MASKED_FIELDS),
      ),
    ]);
    if (staff.status === input.status) {
      return { id: staff.id, status: staff.status };
    }
    return createStaffRepository(tx).updateStatus(staff.id, input.status);
  });
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
    const count = await staffs.softDeleteMany(ids);
    await recordChanges(
      ctx,
      tx,
      rows.map((row) => staffAuditEntry("staff.deleteMany", row, [])),
    );
    return { count };
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
