import type { TestProject } from "vitest/node";

import { startTestDatabase } from "@repo/database/test";
import type { TestDatabase } from "@repo/database/test";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation needs declaration merging
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let database: TestDatabase | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  // Roles + permission catalog (never users): the session tests assert real grants.
  database = await startTestDatabase({ seedReferenceData: true });
  project.provide("databaseUrl", database.connectionString);
};

export const teardown = async (): Promise<void> => {
  await database?.stop();
  database = undefined;
};
