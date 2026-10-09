import type { GeneralStatus, Position, Prisma, SourceArea } from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/**
 * What every screen shows of a branch — the list, the detail, the client's 就業先部署情報 and its
 * dialog, the edit form: the 部署 and 連絡担当者 are columns, so one read serves them all.
 */
const BRANCH_INCLUDE = {
  client: { select: { id: true, number: true, name: true } },
  region: { select: { name: true } },
  address: { include: { sourceAddress: { select: { pref: true, city: true, town: true } } } },
  chargers: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
  },
} satisfies Prisma.BranchInclude;

export type BranchRow = Prisma.BranchGetPayload<{ include: typeof BRANCH_INCLUDE }>;

/** The branch's own columns as a write sets them. */
export type BranchFields = {
  clientId: string;
  number: number;
  name: string;
  nameKana: string;
  area: SourceArea;
  regionCode: number;
  departmentNumber: number;
  departmentName: string;
  departmentNameKana: string;
  departmentFax: string | null;
  contactLastName: string;
  contactFirstName: string;
  contactLastNameKana: string;
  contactFirstNameKana: string;
  contactPosition: Position;
  contactEmail: string;
  memo: string | null;
};

/** The post code (seven digits) and the typed line; the rest comes from the master. */
export type BranchAddressFields = { postCode: string; address1: string };

/** Everything a create writes; an update writes the same through `updateFields` and the 担当者. */
export type BranchWrite = {
  fields: BranchFields;
  address: BranchAddressFields;
  chargerUserIds: readonly string[];
};

/**
 * Pure data access for 就業先部署 (ADR 0011). Reads leave out soft-deleted branches. The service
 * composes the `where` of a list and runs a multi-step write in one transaction.
 */
export const createBranchRepository = (db: DbClient) => ({
  findById: (id: string): Promise<BranchRow | null> =>
    db.branch.findFirst({ where: { id, deletedAt: null }, include: BRANCH_INCLUDE }),

  /** `id` is appended to `orderBy` as a tie-breaker so pages never overlap. */
  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.BranchWhereInput = {},
    orderBy: Prisma.BranchOrderByWithRelationInput[] = [{ number: "asc" }],
  ): Promise<PageResult<BranchRow>> => {
    const page = normalizePage(params);
    const scoped: Prisma.BranchWhereInput = { AND: [where, { deletedAt: null }] };
    const [items, total] = await Promise.all([
      db.branch.findMany({
        where: scoped,
        include: BRANCH_INCLUDE,
        ...toSkipTake(page),
        orderBy: [...orderBy, { id: "asc" }],
      }),
      db.branch.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  /** One nested create: the branch, its address and 担当者. */
  create: (data: BranchWrite): Promise<{ id: string }> =>
    db.branch.create({
      data: {
        ...data.fields,
        address: { create: data.address },
        chargers: { create: data.chargerUserIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    }),

  /** The branch's own columns and its address (created when it has none). */
  updateFields: (
    id: string,
    fields: BranchFields,
    address: BranchAddressFields,
  ): Promise<{ id: string }> =>
    db.branch.update({
      where: { id },
      data: { ...fields, address: { upsert: { create: address, update: address } } },
      select: { id: true },
    }),

  /** The 担当者 become `userIds`: the others are removed, the ones still chosen keep their row. */
  replaceChargers: async (branchId: string, userIds: readonly string[]): Promise<void> => {
    await db.branchCharger.deleteMany({ where: { branchId, userId: { notIn: [...userIds] } } });
    await db.branchCharger.createMany({
      data: userIds.map((userId) => ({ branchId, userId })),
      skipDuplicates: true,
    });
  },

  /** How many of the client's non-deleted branches hold `number`, leaving out `exceptId`. */
  countActiveByNumber: (clientId: string, number: number, exceptId?: string): Promise<number> =>
    db.branch.count({
      where: {
        clientId,
        number,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    }),

  /** The highest 就業先番号 among the client's non-deleted branches, `null` without any. */
  maxNumber: async (clientId: string): Promise<number | null> =>
    (
      await db.branch.aggregate({
        where: { clientId, deletedAt: null },
        _max: { number: true },
      })
    )._max.number,

  /** The statuses of these non-deleted branches, within `where` (the caller's rows). */
  findStatuses: (
    ids: readonly string[],
    where: Prisma.BranchWhereInput = {},
  ): Promise<{ id: string; status: GeneralStatus }[]> =>
    db.branch.findMany({
      where: { AND: [where, { id: { in: [...ids] }, deletedAt: null }] },
      select: { id: true, status: true },
    }),

  updateStatus: (
    id: string,
    status: GeneralStatus,
  ): Promise<{ id: string; status: GeneralStatus }> =>
    db.branch.update({ where: { id }, data: { status }, select: { id: true, status: true } }),

  /** 就業先部署削除 (soft); returns how many were deleted. */
  softDeleteMany: async (ids: readonly string[]): Promise<number> =>
    (
      await db.branch.updateMany({
        where: { id: { in: [...ids] }, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    ).count,
});

export type BranchRepository = ReturnType<typeof createBranchRepository>;
