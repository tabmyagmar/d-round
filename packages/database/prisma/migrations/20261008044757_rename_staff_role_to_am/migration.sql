-- The role key 'staff' (the legacy EnumUserRole.STAFF, labelled AM) becomes 'am', so the key
-- 'staff' stays free for a future login role of スタッフ (docs/adr/0002-auth.md, 2026-10-08).
-- Written as insert / move / delete rather than one UPDATE of roles.key, so it also succeeds on a
-- database where the new roles seed already created 'am' before this migration ran. Grants and the
-- users' roles are carried over unchanged; the role's name follows the label (AM).

-- InsertRole: gen_random_uuid() as in 20261005143913 (uuidv7() needs PostgreSQL 18; ids are never
-- referenced).
INSERT INTO "roles" ("id", "key", "name", "name_jp", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'am', 'AM', 'AM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- MoveUsers
UPDATE "users" SET "role" = 'am' WHERE "role" = 'staff';

-- MoveGrants
INSERT INTO "role_permissions" ("role_key", "permission_key", "created_at", "assigned_by")
SELECT 'am', "permission_key", "created_at", "assigned_by"
FROM "role_permissions"
WHERE "role_key" = 'staff'
ON CONFLICT ("role_key", "permission_key") DO NOTHING;

-- DeleteRole: its remaining role_permissions rows go with it (ON DELETE CASCADE); no user holds it.
DELETE FROM "roles" WHERE "key" = 'staff';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'am';
