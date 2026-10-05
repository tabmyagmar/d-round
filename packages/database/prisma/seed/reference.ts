// Production-safe seed — `yarn db:seed:reference` (tsx prisma/seed/reference.ts). Loads reference
// data only, never test users, so it is the seed for staging and production. Idempotent: a second
// run changes nothing.
import { seedReferenceData } from "./reference-data";
import { runSeeds } from "./support";

await runSeeds("reference", seedReferenceData);
