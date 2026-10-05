// Development seed — `yarn db:seed` (prisma db seed → tsx prisma/seed/index.ts). Runs the
// production-safe reference data first, then the test accounts. Refuses to run with
// NODE_ENV=production (also when it is set only in the root .env); use `yarn db:seed:reference`.
//
// Test accounts (all verified, password `A12345678`):
//   admin@test.com   admin
//   member@test.com  member
import { seedReferenceData } from "./reference-data";
import { assertNotProduction, loadSeedEnv, runSeeds } from "./support";
import { SEED_PASSWORD, SEED_USERS, seedUsers } from "./users.seed";

loadSeedEnv();
assertNotProduction(process.env);

await runSeeds("dev", async (prisma) => [
  ...(await seedReferenceData(prisma)),
  await seedUsers(prisma),
]);

process.stdout.write(
  `seed: ${String(SEED_USERS.length)} test users ready (password ${SEED_PASSWORD}): ${SEED_USERS.map((u) => u.email).join(", ")}\n`,
);
