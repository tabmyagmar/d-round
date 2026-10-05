import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// The whole monorepo shares one root .env (see .env.example). Existing process env
// always wins over the file, which is what CI and testcontainers rely on.
loadEnv({ path: new URL("../../.env", import.meta.url), quiet: true });

// `prisma generate` (run on postinstall) must work without a database, so we do not
// use Prisma's `env()` helper — it throws at config-load time when the variable is
// missing. Commands that actually connect fail loudly on the sentinel host instead.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5432/DATABASE_URL_NOT_SET";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
