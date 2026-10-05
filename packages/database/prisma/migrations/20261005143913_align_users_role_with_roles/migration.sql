-- users.role becomes NOT NULL, defaults to 'staff' and references the role catalog
-- (docs/adr/0002-auth.md, docs/adr/0005-legacy-reference-data.md). Order: insert the catalog rows,
-- backfill, then constrain. `users` is small, so the backfill lives in the same migration.

-- InsertRoles: a migrations-only database (testcontainers, CI, a fresh deploy before
-- `yarn db:seed`) must be able to insert users, so the four rows the foreign key needs are
-- inserted here. gen_random_uuid() (uuid v4) because uuidv7() exists only from PostgreSQL 18; the
-- ids are never referenced. A seeded database keeps its rows; prisma/seed/roles.seed.ts owns the
-- names.
INSERT INTO "roles" ("id", "key", "name", "name_jp", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'super_admin', 'Super admin', 'スーパーアドミン', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'admin', 'Admin', 'アドミン', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'manager', 'Manager', 'マネジャー', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'staff', 'Staff', 'スタッフ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Backfill: NULL and roles outside the catalog (`member`, the template's old default) become 'staff'.
UPDATE "users" SET "role" = 'staff' WHERE "role" IS NULL OR "role" NOT IN (SELECT "key" FROM "roles");

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'staff';
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
