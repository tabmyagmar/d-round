// Seed — `yarn db:seed` (prisma db seed → tsx prisma/seed/index.ts). Runs every dataset in order,
// parents before children. Reference data is idempotent: a re-run reports created 0, updated 0.
// The first run spends about 19 s loading the postal-code master (120,663 rows); re-runs ~1 s.
// The test accounts are created only when NODE_ENV is `development` or `test`.
//
// Test accounts (all verified, password `A12345678`):
//   admin@test.com   admin
//   member@test.com  member
import { seedPermissions } from "./permissions.seed";
import { seedRoles } from "./roles.seed";
import { seedSourceAddresses } from "./source-addresses.seed";
import { seedSourcePrefectures } from "./source-prefectures.seed";
import { seedSourceRegions } from "./source-regions.seed";
import { runSeeds } from "./support";
import { seedUsers } from "./users.seed";

await runSeeds(async (prisma) => [
  await seedRoles(prisma),
  await seedPermissions(prisma),
  await seedSourceRegions(prisma),
  await seedSourcePrefectures(prisma),
  await seedSourceAddresses(prisma),
  await seedUsers(prisma),
]);
