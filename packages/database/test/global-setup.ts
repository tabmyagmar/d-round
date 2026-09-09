import type { TestProject } from "vitest/node";

import { startTestDatabase } from "./index";
import type { TestDatabase } from "./index";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation needs declaration merging
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let database: TestDatabase | undefined;

/** One Postgres container for the whole package test run; tests receive its URL via inject(). */
export const setup = async (project: TestProject): Promise<void> => {
  database = await startTestDatabase();
  project.provide("databaseUrl", database.connectionString);
};

export const teardown = async (): Promise<void> => {
  await database?.stop();
  database = undefined;
};
