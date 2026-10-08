import {
  createBranchRepository,
  createClientRepository,
  createSourceRepository,
  withTransaction,
} from "@repo/database";
import type { BranchRow, BranchWrite, DbClient, PageResult, Prisma } from "@repo/database";
import { accessibleBranchesWhere, prismaBranchSubject } from "@repo/permissions/server";
import { employeeNumberOfSearch } from "@repo/validation";
import type {
  BranchSortField,
  ChangeBranchStatusInput,
  CreateBranchInput,
  DeleteBranchesInput,
  GeneralStatus,
  ListBranchesQuery,
  NextBranchNumberInput,
  SortOrder,
  UpdateBranchInput,
} from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../core/errors";
import { assertKnownSource } from "../source/source.service";
import { assertChargersActive } from "../user/user.service";

/**
 * 就業先部署 (ADR 0011). The router checked the catalog action on the type; this service checks the
 * row (`prismaBranchSubject` for one branch, `accessibleBranchesWhere` for lists and deletes — no
 * row rule today, so the answer equals the type's), the client, the 就業先番号 within the client,
 * the region within the エリア, the post code and the 担当者, and writes a branch in one
 * transaction.
 */

type BranchAction = "create" | "read" | "update" | "delete" | "status";

const assertMay = (ctx: RequestContext, action: BranchAction): void => {
  if (!ctx.ability.can(action, "Branch")) {
    throw new ForbiddenError(`Not allowed to ${action} branches`);
  }
};

const assertCanRow = (ctx: RequestContext, action: BranchAction, branch: BranchRow): void => {
  if (!ctx.ability.can(action, prismaBranchSubject(branch))) {
    throw new ForbiddenError(`Not allowed to ${action} this branch`);
  }
};

const loadBranch = async (db: DbClient, branchId: string): Promise<BranchRow> => {
  const branch = await createBranchRepository(db).findById(branchId);
  if (!branch) {
    throw new NotFoundError("Branch", branchId);
  }
  return branch;
};

/**
 * The allow-listed sort columns as Prisma orderings: 就業先名 and クライアント名 sort by their
 * readings, as the legacy branch list did.
 */
const BRANCH_ORDER_BY: Record<
  BranchSortField,
  (direction: SortOrder) => Prisma.BranchOrderByWithRelationInput[]
> = {
  number: (direction) => [{ number: direction }],
  name: (direction) => [{ nameKana: direction }],
  client: (direction) => [{ client: { nameKana: direction } }],
  createdAt: (direction) => [{ createdAt: direction }],
};

const SUSPENDED: GeneralStatus = "SUSPENDED";

export const list = async (
  ctx: RequestContext,
  query: ListBranchesQuery,
): Promise<PageResult<BranchRow>> => {
  assertMay(ctx, "read");
  const filters: Prisma.BranchWhereInput[] = [
    accessibleBranchesWhere(ctx.ability, "read"),
    // Without a status filter, every branch but the 停止 ones (legacy `status not DELETE`).
    query.statuses?.length ? { status: { in: query.statuses } } : { status: { not: SUSPENDED } },
  ];
  if (query.clientId) {
    filters.push({ clientId: query.clientId });
  }
  if (query.search) {
    const number = employeeNumberOfSearch(query.search);
    filters.push({
      OR: [
        ...(number === null ? [] : [{ number }]),
        { name: { contains: query.search } },
        { nameKana: { contains: query.search } },
        { client: { name: { contains: query.search } } },
        { client: { nameKana: { contains: query.search } } },
        { chargers: { some: { user: { name: { contains: query.search } } } } },
      ],
    });
  }
  if (query.areas?.length) {
    filters.push({ area: { in: query.areas } });
  }
  if (query.regionCodes?.length) {
    filters.push({ regionCode: { in: query.regionCodes } });
  }
  return createBranchRepository(ctx.db).findMany(
    { page: query.page, perPage: query.perPage },
    { AND: filters },
    BRANCH_ORDER_BY[query.sortBy](query.sortOrder),
  );
};

export const getById = async (ctx: RequestContext, branchId: string): Promise<BranchRow> => {
  assertMay(ctx, "read");
  const branch = await loadBranch(ctx.db, branchId);
  assertCanRow(ctx, "read", branch);
  return branch;
};

const BRANCH_NUMBER_TAKEN = "This branch number is already in use for the client";

/**
 * What a write needs beyond its schema: a client that is not deleted (checked when the branch
 * joins it, so a branch of a client deleted since stays editable), the 就業先番号 free within the
 * client, the region known and in the chosen エリア (the legacy form offered only those), the post
 * code known. The 担当者 are checked apart (`assertChargersActive`).
 */
const assertWritable = async (
  db: DbClient,
  input: CreateBranchInput,
  current?: BranchRow,
): Promise<void> => {
  if (
    current?.clientId !== input.clientId &&
    !(await createClientRepository(db).findById(input.clientId))
  ) {
    throw new NotFoundError("Client", input.clientId);
  }
  const holders = await createBranchRepository(db).countActiveByNumber(
    input.clientId,
    input.number,
    current?.id,
  );
  if (holders > 0) {
    throw new ConflictError(BRANCH_NUMBER_TAKEN);
  }
  const region = (await createSourceRepository(db).findRegions()).find(
    (candidate) => candidate.code === input.regionCode,
  );
  if (!region) {
    throw new ValidationError(`Unknown region ${String(input.regionCode)}`);
  }
  if (region.area !== input.area) {
    throw new ValidationError(`Region ${String(input.regionCode)} is not in ${input.area}`);
  }
  await assertKnownSource(db, { postCode: input.address.postCode });
};

/** The parsed form as the repository writes it. */
const toWrite = (input: CreateBranchInput): BranchWrite => ({
  fields: {
    clientId: input.clientId,
    number: input.number,
    name: input.name,
    nameKana: input.nameKana,
    area: input.area,
    regionCode: input.regionCode,
    departmentNumber: input.departmentNumber,
    departmentName: input.departmentName,
    departmentNameKana: input.departmentNameKana,
    departmentFax: input.departmentFax,
    contactLastName: input.contactLastName,
    contactFirstName: input.contactFirstName,
    contactLastNameKana: input.contactLastNameKana,
    contactFirstNameKana: input.contactFirstNameKana,
    contactPosition: input.contactPosition,
    contactEmail: input.contactEmail,
    memo: input.memo,
  },
  address: input.address,
  chargerUserIds: input.chargerUserIds,
});

/** 就業先部署追加 (catalog row 1801): the branch, its address and 担当者 in one transaction. */
export const create = async (ctx: RequestContext, input: CreateBranchInput): Promise<BranchRow> => {
  assertMay(ctx, "create");
  return withTransaction(ctx.db, async ({ tx }) => {
    await assertWritable(tx, input);
    await assertChargersActive(tx, input.chargerUserIds);
    const { id } = await createBranchRepository(tx).create(toWrite(input));
    return loadBranch(tx, id);
  });
};

/**
 * 就業先部署編集 (row 1803): the fields and address (the branch may move to another client), the
 * 担当者 still chosen kept and the new ones checked and added. The legacy notified the
 * administrators when the client changed; notifications are their own ticket.
 */
export const update = async (ctx: RequestContext, input: UpdateBranchInput): Promise<BranchRow> => {
  assertMay(ctx, "update");
  return withTransaction(ctx.db, async ({ tx }) => {
    const branches = createBranchRepository(tx);
    const current = await loadBranch(tx, input.branchId);
    assertCanRow(ctx, "update", current);
    await assertWritable(tx, input, current);
    const before = current.chargers.map((charger) => charger.userId);
    await assertChargersActive(
      tx,
      input.chargerUserIds.filter((userId) => !before.includes(userId)),
    );
    const write = toWrite(input);
    await branches.updateFields(current.id, write.fields, write.address);
    await branches.replaceChargers(current.id, write.chargerUserIds);
    return loadBranch(tx, current.id);
  });
};

/** ステータス変更 (row 1805); the same status is a no-op. */
export const changeStatus = async (
  ctx: RequestContext,
  input: ChangeBranchStatusInput,
): Promise<{ id: string; status: GeneralStatus }> => {
  assertMay(ctx, "status");
  const branch = await loadBranch(ctx.db, input.branchId);
  assertCanRow(ctx, "status", branch);
  if (branch.status === input.status) {
    return { id: branch.id, status: branch.status };
  }
  return createBranchRepository(ctx.db).updateStatus(branch.id, input.status);
};

/**
 * 就業先部署削除 (row 1804): every one of them must be a branch the caller may delete and be 停止
 * (as the client's; the legacy deleted any branch for good); soft delete, which frees the number.
 */
export const removeMany = async (
  ctx: RequestContext,
  input: DeleteBranchesInput,
): Promise<{ count: number }> => {
  assertMay(ctx, "delete");
  return withTransaction(ctx.db, async ({ tx }) => {
    const branches = createBranchRepository(tx);
    const ids = [...new Set(input.branchIds)];
    const rows = await branches.findStatuses(ids, accessibleBranchesWhere(ctx.ability, "delete"));
    if (rows.length !== ids.length) {
      throw new NotFoundError("Branch");
    }
    if (rows.some((row) => row.status !== SUSPENDED)) {
      throw new ConflictError("Only suspended branches can be deleted");
    }
    return { count: await branches.softDeleteMany(ids) };
  });
};

/** The client's next 就業先番号: one above its highest (legacy nextBranchNumber), 1 for the first. */
export const nextNumber = async (
  ctx: RequestContext,
  input: NextBranchNumberInput,
): Promise<number> => {
  if (!ctx.ability.can("create", "Branch") && !ctx.ability.can("update", "Branch")) {
    throw new ForbiddenError("Not allowed to create or update branches");
  }
  return ((await createBranchRepository(ctx.db).maxNumber(input.clientId)) ?? 0) + 1;
};
