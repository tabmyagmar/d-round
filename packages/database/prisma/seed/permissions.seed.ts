// Permission catalog from the legacy d-round master (data/permissions.csv): parents (menu groups,
// `parentKey` empty) and their children, plus one 0/1 flag column per catalog role, named by the
// ROLE_SEEDS keys, so a role without a column fails the header check. Runs after the roles seed,
// in one transaction: a diff-based upsert by `key`, parents before children so every `parentKey`
// exists when its child is written, then the grants the CSV owns (catalog roles x CSV
// permissions) synced to the flags: missing ones created, stale ones deleted, both counted in
// `grants` (printed as `grants +n/-m`). Never deletes a permission, and never touches
// user_permissions or the grants of a role or permission outside the CSV (e.g. added at runtime).
import type { TransactionClient } from "../../src/utils/transaction";

import { ROLE_SEEDS } from "./roles.seed";
import type { RoleKey } from "./roles.seed";
import { diffByKey, emptyToNull, parseFlag, readCsv } from "./support";
import type { SeedFn, SeedSummary } from "./support";

const ROLE_KEYS = ROLE_SEEDS.map((role) => role.key);
const PERMISSION_COLUMNS = [
  "key",
  "name",
  "nameJp",
  "parentKey",
  "action",
  "subject",
  "modelName",
  ...ROLE_KEYS,
] as const;
type PermissionCsvRow = Record<(typeof PERMISSION_COLUMNS)[number], string>;
type PermissionRow = {
  key: string;
  name: string;
  nameJp: string;
  parentKey: string | null;
  action: string;
  subject: string;
  modelName: string;
};
type GrantRow = { roleKey: RoleKey; permissionKey: string };
type GrantChanges = NonNullable<SeedSummary["grants"]>;

const PERMISSIONS_CSV = new URL("./data/permissions.csv", import.meta.url);

const toPermissionRow = (row: PermissionCsvRow): PermissionRow => ({
  key: row.key,
  name: row.name,
  nameJp: row.nameJp,
  parentKey: emptyToNull(row.parentKey),
  action: row.action,
  subject: row.subject,
  modelName: row.modelName,
});

const toGrantRows = (row: PermissionCsvRow): GrantRow[] =>
  ROLE_KEYS.filter((roleKey) => parseFlag(row[roleKey], roleKey)).map((roleKey) => ({
    roleKey,
    permissionKey: row.key,
  }));

const isSamePermission = (a: PermissionRow, b: PermissionRow): boolean =>
  a.name === b.name &&
  a.nameJp === b.nameJp &&
  a.parentKey === b.parentKey &&
  a.action === b.action &&
  a.subject === b.subject &&
  a.modelName === b.modelName;

// Takes any role_permissions pair: rows read back from the table carry a plain string roleKey.
const grantId = (grant: { roleKey: string; permissionKey: string }): string =>
  `${grant.roleKey}/${grant.permissionKey}`;

/** Creates the missing rows and updates the changed ones; returns the number created. */
const writePermissions = async (
  tx: TransactionClient,
  toCreate: PermissionRow[],
  toUpdate: PermissionRow[],
): Promise<number> => {
  const { count } = await tx.permission.createMany({ data: toCreate, skipDuplicates: true });
  for (const { key, ...data } of toUpdate) {
    await tx.permission.update({ where: { key }, data });
  }
  return count;
};

/** Syncs only the pairs the CSV owns: catalog roles (ROLE_SEEDS) x the CSV's permission keys. */
const syncRoleGrants = async (
  tx: TransactionClient,
  permissionKeys: string[],
  desired: GrantRow[],
): Promise<GrantChanges> => {
  const existing = await tx.rolePermission.findMany({
    where: { roleKey: { in: ROLE_KEYS }, permissionKey: { in: permissionKeys } },
    select: { roleKey: true, permissionKey: true },
  });
  const existingIds = new Set(existing.map(grantId));
  const desiredIds = new Set(desired.map(grantId));
  const missing = desired.filter((grant) => !existingIds.has(grantId(grant)));
  const stale = existing.filter((grant) => !desiredIds.has(grantId(grant)));

  const { count: created } = await tx.rolePermission.createMany({
    data: missing,
    skipDuplicates: true,
  });
  if (stale.length === 0) {
    return { created, deleted: 0 };
  }
  const { count: deleted } = await tx.rolePermission.deleteMany({ where: { OR: stale } });
  return { created, deleted };
};

export const seedPermissions: SeedFn = async (prisma) => {
  const csvRows = readCsv(PERMISSIONS_CSV, PERMISSION_COLUMNS);
  const desired = csvRows.map(toPermissionRow);
  const desiredGrants = csvRows.flatMap(toGrantRows);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.permission.findMany({
      select: {
        key: true,
        name: true,
        nameJp: true,
        parentKey: true,
        action: true,
        subject: true,
        modelName: true,
      },
    });
    const { toCreate, toUpdate } = diffByKey(existing, desired, (row) => row.key, isSamePermission);
    const isParent = (row: PermissionRow): boolean => row.parentKey === null;
    const isChild = (row: PermissionRow): boolean => row.parentKey !== null;

    const createdParents = await writePermissions(
      tx,
      toCreate.filter(isParent),
      toUpdate.filter(isParent),
    );
    const createdChildren = await writePermissions(
      tx,
      toCreate.filter(isChild),
      toUpdate.filter(isChild),
    );
    const grants = await syncRoleGrants(
      tx,
      desired.map((row) => row.key),
      desiredGrants,
    );

    return {
      dataset: "permissions",
      rows: desired.length,
      created: createdParents + createdChildren,
      updated: toUpdate.length,
      skipped: 0,
      grants,
    };
  });
};
