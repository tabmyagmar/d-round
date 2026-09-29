import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

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

export const startTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer(TEST_POSTGRES_IMAGE)
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start();
  const connectionString = container.getConnectionUri();
  runMigrations(connectionString);
  const prisma = createPrismaClient({ connectionString, maxConnections: 5 });

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
