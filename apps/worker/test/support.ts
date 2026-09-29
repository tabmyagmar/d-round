import { Writable } from "node:stream";

import { inject } from "vitest";

import { createOutboxEmailRepository, createPrismaClient } from "@repo/database";
import type { OutboxEmail, PrismaClient } from "@repo/database";
import { createLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import { createQueue, createRedisConnection, waitForRedis } from "@repo/queue";
import type { EmailJob, EmailQueue, RedisConnection } from "@repo/queue";

import type { MailBrand } from "../src/mail/templates";

export const silentLogger = (): Logger =>
  createLogger(
    { name: "test", level: "silent" },
    new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  );

export type WorkerHarness = {
  db: PrismaClient;
  connection: RedisConnection;
  logger: Logger;
  brand: MailBrand;
  stop: () => Promise<void>;
};

export const createWorkerHarness = async (): Promise<WorkerHarness> => {
  const db = createPrismaClient({ connectionString: inject("databaseUrl") });
  const connection = createRedisConnection(inject("redisUrl"), { connectionName: "worker-test" });
  await waitForRedis(connection);
  return {
    db,
    connection,
    logger: silentLogger(),
    brand: { appName: "Test App" },
    stop: async () => {
      await connection.quit();
      await db.$disconnect();
    },
  };
};

/** An isolated email queue per test so parallel tests never see each other's jobs. */
export const isolatedEmailQueue = (
  connection: RedisConnection,
  options: { attempts?: number; backoffMs?: number } = {},
): { name: string; queue: EmailQueue } => {
  const name = `email-test-${crypto.randomUUID()}`;
  const queue = createQueue<EmailJob>(name, connection, {
    defaultJobOptions: {
      attempts: options.attempts ?? 2,
      backoff: { type: "fixed", delay: options.backoffMs ?? 20 },
    },
  });
  return { name, queue };
};

export const createPendingEmail = (
  db: PrismaClient,
  overrides: Partial<{ to: string; template: string; payload: object; ageMs: number }> = {},
): Promise<OutboxEmail> =>
  createOutboxEmailRepository(db)
    .create({
      to: overrides.to ?? `${crypto.randomUUID()}@example.com`,
      template: overrides.template ?? "verification-email",
      payload: overrides.payload ?? { name: "Test", url: "https://app.example.com/verify?token=t" },
    })
    .then((row) =>
      overrides.ageMs
        ? db.outboxEmail.update({
            where: { id: row.id },
            data: { createdAt: new Date(Date.now() - (overrides.ageMs ?? 0)) },
          })
        : row,
    );

/** Resolves once the row leaves PENDING or the timeout passes. */
export const waitForFinalStatus = async (
  db: PrismaClient,
  id: string,
  timeoutMs = 10_000,
): Promise<OutboxEmail> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await db.outboxEmail.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING" || Date.now() > deadline) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

/** Resolves once BullMQ reports the job as completed or failed (or the timeout passes). */
export const waitForJobDone = async (
  queue: EmailQueue,
  jobId: string,
  timeoutMs = 10_000,
): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await queue.getJob(jobId);
    const state = job ? await job.getState() : "unknown";
    if (state === "completed" || state === "failed" || Date.now() > deadline) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
