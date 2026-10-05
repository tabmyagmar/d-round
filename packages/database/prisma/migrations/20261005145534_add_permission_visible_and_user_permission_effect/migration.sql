-- permissions.visible (UI/menu filter for a future permission-editing screen, never an
-- authorization input) and user_permissions.effect (ALLOW adds, DENY removes one permission on
-- top of the role's grants). Both columns are defaulted, so this is a single expand stage: no
-- backfill, no new index. See docs/adr/0005-legacy-reference-data.md and
-- docs/adr/0003-permissions.md.

-- CreateEnum
CREATE TYPE "permission_effect" AS ENUM ('ALLOW', 'DENY');

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_permissions" ADD COLUMN     "effect" "permission_effect" NOT NULL DEFAULT 'ALLOW';
