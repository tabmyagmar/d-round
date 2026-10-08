import type {
  EmployeeType,
  FamilyRelation,
  Gender,
  Position,
  Prisma,
  SourceArea,
  StaffMemoType,
  StaffStatus,
} from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

const REGIONS_BY_CODE = {
  include: { region: { select: { name: true } } },
  orderBy: { regionCode: "asc" },
} satisfies Prisma.Staff$regionsArgs;

const CHARGER_USER = {
  include: { user: { select: { id: true, name: true } } },
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
} satisfies Prisma.Staff$chargersArgs;

/** What the list shows: the staff, its regions by name and its current 担当者. */
const STAFF_LIST_INCLUDE = {
  regions: REGIONS_BY_CODE,
  chargers: { ...CHARGER_USER, where: { unassignedAt: null } },
} satisfies Prisma.StaffInclude;

/** What the detail and the edit form need: everything, the 担当者 history included. */
const STAFF_DETAIL_INCLUDE = {
  address: { include: { sourceAddress: { select: { pref: true, city: true, town: true } } } },
  regions: REGIONS_BY_CODE,
  prefectures: {
    include: { prefecture: { select: { name: true } } },
    orderBy: { prefectureCode: "asc" },
  },
  chargers: CHARGER_USER,
  familyMembers: { orderBy: { sortOrder: "asc" } },
  memos: { orderBy: { sortOrder: "asc" } },
  jobHistories: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.StaffInclude;

export type StaffListRow = Prisma.StaffGetPayload<{ include: typeof STAFF_LIST_INCLUDE }>;
export type StaffDetailRow = Prisma.StaffGetPayload<{ include: typeof STAFF_DETAIL_INCLUDE }>;

/** The staff's own columns as a write sets them. */
export type StaffFields = {
  employeeType: EmployeeType;
  employeeNumber: number;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  gender: Gender;
  birthday: Date | null;
  position: Position | null;
  branchName: string | null;
  email: string | null;
  phoneNumber: string | null;
  emergencyPhoneNumber: string | null;
  areas: SourceArea[];
};

/** The post code (seven digits) and the typed line; the rest comes from the master. */
export type StaffAddressFields = { postCode: string; address1: string };

export type StaffFamilyMemberFields = {
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  relation: FamilyRelation | null;
  birthday: Date | null;
};

export type StaffMemoFields = { memoType: StaffMemoType; content: string };

export type StaffJobHistoryFields = {
  hireDate: Date;
  resignationDate: Date | null;
  resignationReason: string | null;
};

/** Everything a create writes; an update writes the same through the replace methods. */
export type StaffWrite = {
  fields: StaffFields;
  address: StaffAddressFields;
  regionCodes: readonly number[];
  prefectureCodes: readonly number[];
  chargerUserIds: readonly string[];
  familyMembers: readonly StaffFamilyMemberFields[];
  memos: readonly StaffMemoFields[];
  jobHistories: readonly StaffJobHistoryFields[];
};

/** A list as the form sent it, each item with its position. */
const inOrder = <T extends object>(items: readonly T[]) =>
  items.map((item, sortOrder) => ({ ...item, sortOrder }));

/** The staff a user is in charge of, as the user detail's 担当スタッフ groups them by region. */
const CHARGED_STAFF_SELECT = {
  id: true,
  employeeNumber: true,
  employeeType: true,
  lastName: true,
  firstName: true,
  regions: { select: { regionCode: true, region: { select: { name: true } } } },
} satisfies Prisma.StaffSelect;

export type ChargedStaffRow = Prisma.StaffGetPayload<{ select: typeof CHARGED_STAFF_SELECT }>;

/**
 * Pure data access for スタッフ (ADR 0008). Reads leave out soft-deleted staff. The service composes
 * the `where` of a list and runs a multi-step write (the replace methods, the 担当者 moves) in one
 * transaction.
 */
export const createStaffRepository = (db: DbClient) => ({
  findById: (id: string): Promise<StaffDetailRow | null> =>
    db.staff.findFirst({ where: { id, deletedAt: null }, include: STAFF_DETAIL_INCLUDE }),

  /** `id` is appended to `orderBy` as a tie-breaker so pages never overlap. */
  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.StaffWhereInput = {},
    orderBy: Prisma.StaffOrderByWithRelationInput[] = [{ employeeNumber: "asc" }],
  ): Promise<PageResult<StaffListRow>> => {
    const page = normalizePage(params);
    const scoped: Prisma.StaffWhereInput = { AND: [where, { deletedAt: null }] };
    const [items, total] = await Promise.all([
      db.staff.findMany({
        where: scoped,
        include: STAFF_LIST_INCLUDE,
        ...toSkipTake(page),
        orderBy: [...orderBy, { id: "asc" }],
      }),
      db.staff.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  /** One nested create: the staff, its address, codes, 担当者 and lists. */
  create: (data: StaffWrite): Promise<{ id: string }> =>
    db.staff.create({
      data: {
        ...data.fields,
        address: { create: data.address },
        regions: { create: data.regionCodes.map((regionCode) => ({ regionCode })) },
        prefectures: {
          create: data.prefectureCodes.map((prefectureCode) => ({ prefectureCode })),
        },
        chargers: { create: data.chargerUserIds.map((userId) => ({ userId })) },
        familyMembers: { create: inOrder(data.familyMembers) },
        memos: { create: inOrder(data.memos) },
        jobHistories: { create: inOrder(data.jobHistories) },
      },
      select: { id: true },
    }),

  /** The staff's own columns and its address (created when it has none). */
  updateFields: (
    id: string,
    fields: StaffFields,
    address: StaffAddressFields,
  ): Promise<{ id: string }> =>
    db.staff.update({
      where: { id },
      data: { ...fields, address: { upsert: { create: address, update: address } } },
      select: { id: true },
    }),

  replaceRegions: async (staffId: string, regionCodes: readonly number[]): Promise<void> => {
    await db.staffRegion.deleteMany({ where: { staffId } });
    await db.staffRegion.createMany({
      data: regionCodes.map((regionCode) => ({ staffId, regionCode })),
    });
  },

  replacePrefectures: async (
    staffId: string,
    prefectureCodes: readonly number[],
  ): Promise<void> => {
    await db.staffPrefecture.deleteMany({ where: { staffId } });
    await db.staffPrefecture.createMany({
      data: prefectureCodes.map((prefectureCode) => ({ staffId, prefectureCode })),
    });
  },

  replaceFamilyMembers: async (
    staffId: string,
    members: readonly StaffFamilyMemberFields[],
  ): Promise<void> => {
    await db.staffFamilyMember.deleteMany({ where: { staffId } });
    await db.staffFamilyMember.createMany({
      data: inOrder(members).map((member) => ({ ...member, staffId })),
    });
  },

  replaceMemos: async (staffId: string, memos: readonly StaffMemoFields[]): Promise<void> => {
    await db.staffMemo.deleteMany({ where: { staffId } });
    await db.staffMemo.createMany({ data: inOrder(memos).map((memo) => ({ ...memo, staffId })) });
  },

  replaceJobHistories: async (
    staffId: string,
    jobHistories: readonly StaffJobHistoryFields[],
  ): Promise<void> => {
    await db.staffJobHistory.deleteMany({ where: { staffId } });
    await db.staffJobHistory.createMany({
      data: inOrder(jobHistories).map((job) => ({ ...job, staffId })),
    });
  },

  /** The users currently in charge of the staff. */
  findCurrentChargerIds: async (staffId: string): Promise<string[]> =>
    (
      await db.staffCharger.findMany({
        where: { staffId, unassignedAt: null },
        select: { userId: true },
      })
    ).map((charger) => charger.userId),

  /** Ends the current charges of `userIds` (history stays); returns how many ended. */
  closeChargers: async (staffId: string, userIds: readonly string[]): Promise<number> =>
    (
      await db.staffCharger.updateMany({
        where: { staffId, userId: { in: [...userIds] }, unassignedAt: null },
        data: { unassignedAt: new Date() },
      })
    ).count,

  addChargers: async (staffId: string, userIds: readonly string[]): Promise<void> => {
    await db.staffCharger.createMany({ data: userIds.map((userId) => ({ staffId, userId })) });
  },

  /** How many non-deleted staff hold `employeeNumber`, leaving out `exceptId`. */
  countActiveByEmployeeNumber: (employeeNumber: number, exceptId?: string): Promise<number> =>
    db.staff.count({
      where: {
        employeeNumber,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    }),

  findStatuses: (ids: readonly string[]): Promise<{ id: string; status: StaffStatus }[]> =>
    db.staff.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true, status: true },
    }),

  updateStatus: (id: string, status: StaffStatus): Promise<{ id: string; status: StaffStatus }> =>
    db.staff.update({ where: { id }, data: { status }, select: { id: true, status: true } }),

  /** スタッフ削除 (soft); returns how many were deleted. */
  softDeleteMany: async (ids: readonly string[]): Promise<number> =>
    (
      await db.staff.updateMany({
        where: { id: { in: [...ids] }, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    ).count,

  /** The non-deleted staff `userId` is currently in charge of, in kana order. */
  findManyByCharger: (userId: string): Promise<ChargedStaffRow[]> =>
    db.staff.findMany({
      where: { deletedAt: null, chargers: { some: { userId, unassignedAt: null } } },
      select: CHARGED_STAFF_SELECT,
      orderBy: [{ lastNameKana: "asc" }, { firstNameKana: "asc" }, { id: "asc" }],
    }),
});

export type StaffRepository = ReturnType<typeof createStaffRepository>;
