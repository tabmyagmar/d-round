import { Writable } from "node:stream";

import { inject } from "vitest";

import { createAuth } from "@repo/auth";
import type { Auth, VerificationEmail } from "@repo/auth";
import { createPrismaClient } from "@repo/database";
import type { PrismaClient, User } from "@repo/database";
import { createLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import {
  EMAIL_TEMPLATES,
  createEmailQueue,
  createRedisConnection,
  waitForRedis,
} from "@repo/queue";
import type { EmailQueue, RedisConnection } from "@repo/queue";
import { DEFAULT_ROLE } from "@repo/validation";
import type { Role } from "@repo/validation";

import { buildRequestContext } from "../src/core/context";
import type { RequestContext } from "../src/core/context";
import { sendEmail } from "../src/modules/email/email.service";

/** Shared wiring for API tests: real Postgres + Redis (testcontainers), real Better Auth. */

export const silentLogger = (): Logger =>
  createLogger(
    { name: "test", level: "silent" },
    new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  );

export type TestHarness = {
  db: PrismaClient;
  redis: RedisConnection;
  auth: Auth;
  emailQueue: EmailQueue;
  logger: Logger;
  /** Every verification mail Better Auth asked for (also written to the outbox). */
  sentMails: VerificationEmail[];
  stop: () => Promise<void>;
};

export const TEST_WEB_ORIGIN = "http://localhost:3000";
export const TEST_PASSWORD = "correct-horse-battery";

export const createHarness = async (): Promise<TestHarness> => {
  const db = createPrismaClient({ connectionString: inject("databaseUrl") });
  const redis = createRedisConnection(inject("redisUrl"), { connectionName: "api-test" });
  await waitForRedis(redis);
  const logger = silentLogger();
  const emailQueue = createEmailQueue(redis);
  const sentMails: VerificationEmail[] = [];

  const auth = createAuth({
    prisma: db,
    secret: "test-secret-test-secret-test-secret-1234",
    baseURL: "http://localhost:4000",
    trustedOrigins: [TEST_WEB_ORIGIN],
    sendVerificationEmail: async (mail) => {
      sentMails.push(mail);
      await sendEmail(
        { db, emailQueue, logger },
        {
          to: mail.user.email,
          template: EMAIL_TEMPLATES.verification,
          payload: { name: mail.user.name, url: mail.url },
        },
      );
    },
  });

  return {
    db,
    redis,
    auth,
    emailQueue,
    logger,
    sentMails,
    stop: async () => {
      await emailQueue.close();
      await redis.quit();
      await db.$disconnect();
    },
  };
};

/** Cookie header value from a Set-Cookie response, for follow-up requests. */
export const cookieHeaderFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]?.trim() ?? "")
    .filter((cookie) => cookie.includes("="))
    .join("; ");

export type SignedInUser = {
  user: User;
  email: string;
  /** Request headers carrying the session cookie. */
  headers: Headers;
};

/**
 * Creates a verified user with the requested role through the admin plugin's `createUser`
 * (server-side, no session needed — the only way a user gets created now that public sign-up
 * is off), then signs in for real to obtain a session cookie.
 */
export const signedInUser = async (
  harness: TestHarness,
  options: { role?: Role; name?: string } = {},
): Promise<SignedInUser> => {
  const email = `${crypto.randomUUID()}@example.com`;
  await harness.auth.api.createUser({
    body: {
      email,
      password: TEST_PASSWORD,
      name: options.name ?? "Test User",
      role: options.role ?? DEFAULT_ROLE,
      data: { emailVerified: true },
    },
  });
  const user = await harness.db.user.findUniqueOrThrow({ where: { email } });
  const response = await harness.auth.api.signInEmail({
    body: { email, password: TEST_PASSWORD },
    asResponse: true,
  });
  return { user, email, headers: new Headers({ cookie: cookieHeaderFrom(response) }) };
};

/** A RequestContext exactly as the transport would build it for these headers. */
export const contextFor = (
  harness: TestHarness,
  headers = new Headers(),
): Promise<RequestContext> =>
  buildRequestContext(
    { headers, requestId: `test-${crypto.randomUUID()}` },
    { logger: harness.logger, db: harness.db, redis: harness.redis, auth: harness.auth },
  );
