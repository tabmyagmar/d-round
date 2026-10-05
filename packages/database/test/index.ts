import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { seedPermissions } from "../prisma/seed/permissions.seed";
import { seedRoles } from "../prisma/seed/roles.seed";
import { createPrismaClient } from "../src/client";
import type { PrismaClient } from "../src/client";

/**
 * Testcontainers helpers shared by every package that touches Postgres. Tests run
 * against a real database with the real migrations — never against mocks.
 */

/** Same image as docker-compose (POSTGRES_IMAGE) so tests see the same Postgres. */
export const TEST_POSTGRES_IMAGE = process.env["TEST_POSTGRES_IMAGE"] ?? "postgres:18-alpine";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

export type TestDatabase = {
  container: StartedPostgreSqlContainer;
  connectionString: string;
  prisma: PrismaClient;
  stop: () => Promise<void>;
};

/** Applies the committed migrations (prisma migrate deploy) to the given database. */
export const runMigrations = (connectionString: string): void => {
  execFileSync("yarn", ["prisma", "migrate", "deploy"], {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: "pipe",
  });
};

export type StartTestDatabaseOptions = {
  /**
   * Also load the role and permission catalog (`seedRoles` + `seedPermissions`, ~1 s; never users
   * or addresses) once the migrations are applied, for packages whose tests need real grants
   * (`@repo/auth`, `@repo/api`). Defaults to `false`: the `database` package's seed tests seed
   * themselves and assert exact row counts.
   */
  seedReferenceData?: boolean;
};

/**
 * Starts a Postgres container, applies the committed migrations and returns a connected Prisma
 * client; `stop()` disconnects and removes the container.
 */
export const startTestDatabase = async (
  options: StartTestDatabaseOptions = {},
): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer(TEST_POSTGRES_IMAGE)
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start();
  const connectionString = container.getConnectionUri();
  runMigrations(connectionString);
  const prisma = createPrismaClient({ connectionString, maxConnections: 5 });
  if (options.seedReferenceData === true) {
    await seedRoles(prisma);
    await seedPermissions(prisma);
  }

  return {
    container,
    connectionString,
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
};
