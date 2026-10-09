import { createClientRepository, withTransaction } from "@repo/database";
import type {
  ClientDetailRow,
  ClientListRow,
  ClientOptionRow,
  ClientWrite,
  DbClient,
  PageResult,
  Prisma,
} from "@repo/database";
import { accessibleClientsWhere, prismaClientSubject } from "@repo/permissions/server";
import { employeeNumberOfSearch } from "@repo/validation";
import type {
  ChangeClientStatusInput,
  ClientNumberAvailableInput,
  ClientOptionsInput,
  ClientSortField,
  CreateClientInput,
  DeleteClientsInput,
  GeneralStatus,
  ListClientsQuery,
  SortOrder,
  UpdateClientInput,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";
import { assertKnownSource } from "../source/source.service";
import { assertChargersActive } from "../user/user.service";

/**
 * クライアント (ADR 0011). The router checked the catalog action on the type; this service checks the
 * row (`prismaClientSubject` for one client, `accessibleClientsWhere` for lists and deletes — no
 * row rule today, so the answer equals the type's), the クライアント番号 among non-deleted clients,
 * the reference data and the 担当者, and writes a client with its children in one transaction.
 */

type ClientAction = "create" | "read" | "update" | "delete" | "status";

const assertMay = (ctx: RequestContext, action: ClientAction): void => {
  if (!ctx.ability.can(action, "Client")) {
    throw new ForbiddenError(`Not allowed to ${action} clients`);
  }
};

const assertCanRow = (ctx: RequestContext, action: ClientAction, client: ClientDetailRow): void => {
  if (!ctx.ability.can(action, prismaClientSubject(client))) {
    throw new ForbiddenError(`Not allowed to ${action} this client`);
  }
};

const loadClient = async (db: DbClient, clientId: string): Promise<ClientDetailRow> => {
  const client = await createClientRepository(db).findById(clientId);
  if (!client) {
    throw new NotFoundError("Client", clientId);
  }
  return client;
};

/**
 * The allow-listed sort columns as Prisma orderings. クライアント名 sorts by its reading, as the
 * legacy 就業先部署 list did (a sort by the kanji follows code points, not the Japanese order).
 */
const CLIENT_ORDER_BY: Record<
  ClientSortField,
  (direction: SortOrder) => Prisma.ClientOrderByWithRelationInput[]
> = {
  number: (direction) => [{ number: direction }],
  name: (direction) => [{ nameKana: direction }],
  createdAt: (direction) => [{ createdAt: direction }],
};

const SUSPENDED: GeneralStatus = "SUSPENDED";

/** A search matches the クライアント番号 when it is one, the name and the reading. */
const searchFilters = (search: string): Prisma.ClientWhereInput[] => {
  const number = employeeNumberOfSearch(search);
  return [
    ...(number === null ? [] : [{ number }]),
    { name: { contains: search } },
    { nameKana: { contains: search } },
  ];
};

export const list = async (
  ctx: RequestContext,
  query: ListClientsQuery,
): Promise<PageResult<ClientListRow>> => {
  assertMay(ctx, "read");
  const filters: Prisma.ClientWhereInput[] = [
    accessibleClientsWhere(ctx.ability, "read"),
    // Without a status filter, every client but the 停止 ones (legacy `status not DELETE`).
    query.statuses?.length ? { status: { in: query.statuses } } : { status: { not: SUSPENDED } },
  ];
  if (query.search) {
    filters.push({
      OR: [
        ...searchFilters(query.search),
        { chargers: { some: { user: { name: { contains: query.search } } } } },
      ],
    });
  }
  if (query.areas?.length) {
    filters.push({ areas: { hasSome: query.areas } });
  }
  if (query.regionCodes?.length) {
    filters.push({ regions: { some: { regionCode: { in: query.regionCodes } } } });
  }
  if (query.orderTypes?.length) {
    filters.push({ orderTypes: { hasSome: query.orderTypes } });
  }
  return createClientRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
    CLIENT_ORDER_BY[query.sortBy](query.sortOrder),
  );
};

export const getById = async (ctx: RequestContext, clientId: string): Promise<ClientDetailRow> => {
  assertMay(ctx, "read");
  const client = await loadClient(ctx.db, clientId);
  assertCanRow(ctx, "read", client);
  return client;
};

const CLIENT_NUMBER_TAKEN = "This client number is already in use";

/**
 * What a write needs beyond its schema: the クライアント番号 free among non-deleted clients, the
 * regions and post code known. The 担当者 are checked apart (`assertChargersActive`).
 */
const assertWritable = async (
  db: DbClient,
  input: CreateClientInput,
  clientId?: string,
): Promise<void> => {
  if ((await createClientRepository(db).countActiveByNumber(input.number, clientId)) > 0) {
    throw new ConflictError(CLIENT_NUMBER_TAKEN);
  }
  await assertKnownSource(db, {
    regionCodes: input.regionCodes,
    postCode: input.address.postCode,
  });
};

/** The parsed form as the repository writes it. */
const toWrite = (input: CreateClientInput): ClientWrite => ({
  fields: {
    number: input.number,
    name: input.name,
    nameKana: input.nameKana,
    areas: input.areas,
    orderTypes: input.orderTypes,
    phoneNumber: input.phoneNumber,
    fax: input.fax,
    webUrl: input.webUrl,
  },
  address: input.address,
  regionCodes: input.regionCodes,
  chargerUserIds: input.chargerUserIds,
});

/** クライアント追加 (catalog row 1201): the client, its address, regions and 担当者 in one transaction. */
export const create = async (
  ctx: RequestContext,
  input: CreateClientInput,
): Promise<ClientDetailRow> => {
  assertMay(ctx, "create");
  return withTransaction(ctx.db, async ({ tx }) => {
    await assertWritable(tx, input);
    await assertChargersActive(tx, input.chargerUserIds);
    const { id } = await createClientRepository(tx).create(toWrite(input));
    return loadClient(tx, id);
  });
};

/**
 * クライアント情報編集 (row 1203): the fields and address, the regions replaced, the 担当者 still
 * chosen kept and the new ones checked and added.
 */
export const update = async (
  ctx: RequestContext,
  input: UpdateClientInput,
): Promise<ClientDetailRow> => {
  assertMay(ctx, "update");
  return withTransaction(ctx.db, async ({ tx }) => {
    const clients = createClientRepository(tx);
    const current = await loadClient(tx, input.clientId);
    assertCanRow(ctx, "update", current);
    await assertWritable(tx, input, current.id);
    const before = current.chargers.map((charger) => charger.userId);
    await assertChargersActive(
      tx,
      input.chargerUserIds.filter((userId) => !before.includes(userId)),
    );
    const write = toWrite(input);
    await clients.updateFields(current.id, write.fields, write.address);
    await clients.replaceRegions(current.id, write.regionCodes);
    await clients.replaceChargers(current.id, write.chargerUserIds);
    return loadClient(tx, current.id);
  });
};

/** ステータス変更 (row 1205); the same status is a no-op. */
export const changeStatus = async (
  ctx: RequestContext,
  input: ChangeClientStatusInput,
): Promise<{ id: string; status: GeneralStatus }> => {
  assertMay(ctx, "status");
  const client = await loadClient(ctx.db, input.clientId);
  assertCanRow(ctx, "status", client);
  if (client.status === input.status) {
    return { id: client.id, status: client.status };
  }
  return createClientRepository(ctx.db).updateStatus(client.id, input.status);
};

/**
 * クライアント削除 (row 1204): every one of them must be a client the caller may delete and be 停止
 * (legacy `deleteClients where status DELETE`); soft delete, which frees the クライアント番号.
 */
export const removeMany = async (
  ctx: RequestContext,
  input: DeleteClientsInput,
): Promise<{ count: number }> => {
  assertMay(ctx, "delete");
  return withTransaction(ctx.db, async ({ tx }) => {
    const clients = createClientRepository(tx);
    const ids = [...new Set(input.clientIds)];
    const rows = await clients.findStatuses(ids, accessibleClientsWhere(ctx.ability, "delete"));
    if (rows.length !== ids.length) {
      throw new NotFoundError("Client");
    }
    if (rows.some((row) => row.status !== SUSPENDED)) {
      throw new ConflictError("Only suspended clients can be deleted");
    }
    return { count: await clients.softDeleteMany(ids) };
  });
};

/** Whether no other non-deleted client holds the クライアント番号 (legacy clientNumberExists). */
export const isNumberAvailable = async (
  ctx: RequestContext,
  input: ClientNumberAvailableInput,
): Promise<boolean> => {
  if (!ctx.ability.can("create", "Client") && !ctx.ability.can("update", "Client")) {
    throw new ForbiddenError("Not allowed to create or update clients");
  }
  const holders = await createClientRepository(ctx.db).countActiveByNumber(
    input.number,
    input.excludeClientId,
  );
  return holders === 0;
};

/** The most clients one search of the 就業先部署 form returns. */
export const CLIENT_OPTIONS_MAX = 20;

/**
 * The clients the 就業先部署 form offers (legacy chargerClients): non-deleted, any status, within
 * the caller's client read rules, in kana order, matching the search when there is one.
 */
export const options = async (
  ctx: RequestContext,
  input: ClientOptionsInput,
): Promise<ClientOptionRow[]> => {
  assertMay(ctx, "read");
  const filters: Prisma.ClientWhereInput[] = [accessibleClientsWhere(ctx.ability, "read")];
  if (input.search) {
    filters.push({ OR: searchFilters(input.search) });
  }
  return createClientRepository(ctx.db).findOptions({ AND: filters }, CLIENT_OPTIONS_MAX);
};
