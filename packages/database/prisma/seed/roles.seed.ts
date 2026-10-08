// Role catalog (access/role.prisma). Inline instead of a CSV: four rows whose keys also name the
// role flag columns of data/permissions.csv (`RoleKey`). Keys are lower-case like Better Auth's
// `users.role`, which references them (FK). Migration 20261005143913 also inserts the four rows
// so a migrations-only database can insert users; this seed keeps the names in sync and never
// deletes a role. Diff-based upsert by `key`: missing rows created, changed rows updated, the
// rest untouched.
import { diffByKey } from "./support";
import type { SeedFn } from "./support";

export const ROLE_SEEDS = [
  { key: "super_admin", name: "Super admin", nameJp: "スーパーアドミン" },
  { key: "admin", name: "Admin", nameJp: "アドミン" },
  { key: "manager", name: "Manager", nameJp: "マネジャー" },
  { key: "am", name: "AM", nameJp: "AM" },
] as const;

export type RoleKey = (typeof ROLE_SEEDS)[number]["key"];

type RoleRow = { key: string; name: string; nameJp: string };

const isSameRole = (a: RoleRow, b: RoleRow): boolean => a.name === b.name && a.nameJp === b.nameJp;

export const seedRoles: SeedFn = async (prisma) => {
  const existing = await prisma.role.findMany({ select: { key: true, name: true, nameJp: true } });
  const { toCreate, toUpdate } = diffByKey<RoleRow>(
    existing,
    ROLE_SEEDS,
    (row) => row.key,
    isSameRole,
  );

  const { count: created } = await prisma.role.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
  for (const { key, ...data } of toUpdate) {
    await prisma.role.update({ where: { key }, data });
  }

  return {
    dataset: "roles",
    rows: ROLE_SEEDS.length,
    created,
    updated: toUpdate.length,
    skipped: 0,
  };
};
