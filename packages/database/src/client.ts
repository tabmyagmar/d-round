import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

export type { PrismaClient };

export type CreatePrismaClientOptions = {
  connectionString: string;
  /** pg pool size. Keep small for workers, larger for the API. */
  maxConnections?: number;
};

/**
 * Prisma 7 needs a driver adapter; pg is the only one we use. Apps create exactly one
 * client per process (see getPrismaClient) and tests create one per container.
 */
export const createPrismaClient = (options: CreatePrismaClientOptions): PrismaClient => {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    ...(options.maxConnections === undefined ? {} : { max: options.maxConnections }),
  });
  return new PrismaClient({ adapter });
};

let singleton: PrismaClient | undefined;

/** Process-wide singleton for long-running apps (api, worker). */
export const getPrismaClient = (options: CreatePrismaClientOptions): PrismaClient => {
  singleton ??= createPrismaClient(options);
  return singleton;
};

export const disconnectPrismaClient = async (): Promise<void> => {
  if (singleton) {
    await singleton.$disconnect();
    singleton = undefined;
  }
};
