import type {
  ClientOrderType,
  GeneralStatus,
  Prisma,
  SourceArea,
} from "../generated/prisma/client";
import { buildPage, normalizePage, toSkipTake } from "../utils/pagination";
import type { PageParams, PageResult } from "../utils/pagination";
import type { DbClient } from "../utils/transaction";

/** The 担当者 with their names, in the order they were assigned. */
const CHARGER_USERS = {
  include: { user: { select: { id: true, name: true } } },
  orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
} satisfies Prisma.Client$chargersArgs;

/** What the list shows: the client, its address with the master's parts and its 担当者. */
const CLIENT_LIST_INCLUDE = {
  address: { include: { sourceAddress: { select: { pref: true, city: true, town: true } } } },
  chargers: CHARGER_USERS,
} satisfies Prisma.ClientInclude;

/** What the detail and the edit form need: the list's and the regions by name. */
const CLIENT_DETAIL_INCLUDE = {
  ...CLIENT_LIST_INCLUDE,
  regions: { include: { region: { select: { name: true } } }, orderBy: { regionCode: "asc" } },
} satisfies Prisma.ClientInclude;

const CLIENT_OPTION_SELECT = { id: true, name: true } satisfies Prisma.ClientSelect;

export type ClientListRow = Prisma.ClientGetPayload<{ include: typeof CLIENT_LIST_INCLUDE }>;
export type ClientDetailRow = Prisma.ClientGetPayload<{ include: typeof CLIENT_DETAIL_INCLUDE }>;
/** A client as the 就業先部署 form offers it. */
export type ClientOptionRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_OPTION_SELECT }>;

/** The client's own columns as a write sets them. */
export type ClientFields = {
  number: number;
  name: string;
  nameKana: string;
  areas: SourceArea[];
  orderTypes: ClientOrderType[];
  phoneNumber: string;
  fax: string | null;
  webUrl: string | null;
};

/** The post code (seven digits) and the typed line; the rest comes from the master. */
export type ClientAddressFields = { postCode: string; address1: string };

/** Everything a create writes; an update writes the same through the replace methods. */
export type ClientWrite = {
  fields: ClientFields;
  address: ClientAddressFields;
  regionCodes: readonly number[];
  chargerUserIds: readonly string[];
};

/**
 * Pure data access for クライアント (ADR 0011). Reads leave out soft-deleted clients. The service
 * composes the `where` of a list and runs a multi-step write in one transaction.
 */
export const createClientRepository = (db: DbClient) => ({
  findById: (id: string): Promise<ClientDetailRow | null> =>
    db.client.findFirst({ where: { id, deletedAt: null }, include: CLIENT_DETAIL_INCLUDE }),

  /** `id` is appended to `orderBy` as a tie-breaker so pages never overlap. */
  findMany: async (
    params: Partial<PageParams>,
    where: Prisma.ClientWhereInput = {},
    orderBy: Prisma.ClientOrderByWithRelationInput[] = [{ number: "asc" }],
  ): Promise<PageResult<ClientListRow>> => {
    const page = normalizePage(params);
    const scoped: Prisma.ClientWhereInput = { AND: [where, { deletedAt: null }] };
    const [items, total] = await Promise.all([
      db.client.findMany({
        where: scoped,
        include: CLIENT_LIST_INCLUDE,
        ...toSkipTake(page),
        orderBy: [...orderBy, { id: "asc" }],
      }),
      db.client.count({ where: scoped }),
    ]);
    return buildPage(items, total, page);
  },

  /** One nested create: the client, its address, regions and 担当者. */
  create: (data: ClientWrite): Promise<{ id: string }> =>
    db.client.create({
      data: {
        ...data.fields,
        address: { create: data.address },
        regions: { create: data.regionCodes.map((regionCode) => ({ regionCode })) },
        chargers: { create: data.chargerUserIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    }),

  /** The client's own columns and its address (created when it has none). */
  updateFields: (
    id: string,
    fields: ClientFields,
    address: ClientAddressFields,
  ): Promise<{ id: string }> =>
    db.client.update({
      where: { id },
      data: { ...fields, address: { upsert: { create: address, update: address } } },
      select: { id: true },
    }),

  replaceRegions: async (clientId: string, regionCodes: readonly number[]): Promise<void> => {
    await db.clientRegion.deleteMany({ where: { clientId } });
    await db.clientRegion.createMany({
      data: regionCodes.map((regionCode) => ({ clientId, regionCode })),
    });
  },

  /** The 担当者 become `userIds`: the others are removed, the ones still chosen keep their row. */
  replaceChargers: async (clientId: string, userIds: readonly string[]): Promise<void> => {
    await db.clientCharger.deleteMany({ where: { clientId, userId: { notIn: [...userIds] } } });
    await db.clientCharger.createMany({
      data: userIds.map((userId) => ({ clientId, userId })),
      skipDuplicates: true,
    });
  },

  /** How many non-deleted clients hold `number`, leaving out `exceptId`. */
  countActiveByNumber: (number: number, exceptId?: string): Promise<number> =>
    db.client.count({
      where: { number, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    }),

  /** The statuses of these non-deleted clients, within `where` (the caller's rows). */
  findStatuses: (
    ids: readonly string[],
    where: Prisma.ClientWhereInput = {},
  ): Promise<{ id: string; status: GeneralStatus }[]> =>
    db.client.findMany({
      where: { AND: [where, { id: { in: [...ids] }, deletedAt: null }] },
      select: { id: true, status: true },
    }),

  updateStatus: (
    id: string,
    status: GeneralStatus,
  ): Promise<{ id: string; status: GeneralStatus }> =>
    db.client.update({ where: { id }, data: { status }, select: { id: true, status: true } }),

  /** クライアント削除 (soft); returns how many were deleted. */
  softDeleteMany: async (ids: readonly string[]): Promise<number> =>
    (
      await db.client.updateMany({
        where: { id: { in: [...ids] }, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    ).count,

  /** Non-deleted clients within `where`, in kana order, at most `take`. */
  findOptions: (where: Prisma.ClientWhereInput, take: number): Promise<ClientOptionRow[]> =>
    db.client.findMany({
      where: { AND: [where, { deletedAt: null }] },
      select: CLIENT_OPTION_SELECT,
      orderBy: [{ nameKana: "asc" }, { number: "asc" }, { id: "asc" }],
      take,
    }),
});

export type ClientRepository = ReturnType<typeof createClientRepository>;
