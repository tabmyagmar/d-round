import { Writable } from "node:stream";

import { inject } from "vitest";

import { createAuth } from "@repo/auth";
import type { Auth, VerificationEmail } from "@repo/auth";
import { createPrismaClient, createUserRepository } from "@repo/database";
import type { PrismaClient, User, UserProfileData } from "@repo/database";
import { createLogger } from "@repo/logger";
import type { Logger } from "@repo/logger";
import { createEmailQueue, createRedisConnection, waitForRedis } from "@repo/queue";
import type { EmailQueue, RedisConnection } from "@repo/queue";
import { DEFAULT_ROLE } from "@repo/validation";
import type { CreateStaffInput, Role } from "@repo/validation";

import { buildRequestContext } from "../src/core/context";
import type { RequestContext } from "../src/core/context";
import { createAuthEmailSenders } from "../src/modules/email/auth-emails";

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
  // The production callbacks (outbox rows + jobs), with the verification mails also recorded.
  const senders = createAuthEmailSenders({ db, emailQueue, logger });

  const auth = createAuth({
    prisma: db,
    secret: "test-secret-test-secret-test-secret-1234",
    baseURL: "http://localhost:4000",
    trustedOrigins: [TEST_WEB_ORIGIN],
    sendVerificationEmail: async (mail) => {
      sentMails.push(mail);
      await senders.sendVerificationEmail(mail);
    },
    sendPasswordResetEmail: senders.sendPasswordResetEmail,
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

/** A 社員番号 no other test uses: every API test file shares one database. */
export const uniqueEmployeeNumber = (): number => 100_000 + Math.floor(Math.random() * 999_000_000);

/** A 担当者 profile for `signedInUser`; every field defaults (region 4, 南関東). */
export type TestProfile = Partial<UserProfileData> & { regionCodes?: number[] };

/**
 * Creates a verified user with the requested role through the admin plugin's `createUser`
 * (server-side, no session needed — the only way a user gets created now that public sign-up
 * is off), then signs in for real to obtain a session cookie. With `profile`, the user also gets a
 * 担当者 profile (unique 社員番号 unless given) and its regions.
 */
export const signedInUser = async (
  harness: TestHarness,
  options: { role?: Role; name?: string; profile?: TestProfile } = {},
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
  if (options.profile) {
    const { regionCodes = [4], ...fields } = options.profile;
    const users = createUserRepository(harness.db);
    await users.upsertProfile(user.id, {
      employeeNumber: uniqueEmployeeNumber(),
      departmentName: "テスト部",
      position: "SV",
      retirementDate: null,
      areas: ["EAST"],
      ...fields,
    });
    await users.replaceProfileRegions(user.id, regionCodes);
  }
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
    {
      logger: harness.logger,
      db: harness.db,
      redis: harness.redis,
      auth: harness.auth,
      webOrigin: TEST_WEB_ORIGIN,
    },
  );

/** The post code the staff tests use; the harness database has no Japan Post master of its own. */
export const TEST_POST_CODE = "1600022";

/** Makes sure `TEST_POST_CODE` exists in `source_addresses` (東京都 新宿区 新宿). */
export const ensureTestPostCode = async (harness: TestHarness): Promise<void> => {
  await harness.db.sourceAddress.upsert({
    where: { postCode: TEST_POST_CODE },
    update: {},
    create: {
      jisCode: 13104,
      postCode: TEST_POST_CODE,
      pref: "東京都",
      city: "新宿区",
      town: "新宿",
    },
  });
};

/**
 * A parsed スタッフ追加 input (as the router hands it to the service): a unique スタッフ番号, 南関東 /
 * 東京都 at `TEST_POST_CODE`, the given 担当者, one employment, one family member and two memos (one
 * without text). Call `ensureTestPostCode` first.
 */
export const staffInput = (
  chargerUserIds: string[],
  overrides: Partial<CreateStaffInput> = {},
): CreateStaffInput => ({
  employeeType: "FULL_TIME",
  employeeNumber: uniqueEmployeeNumber(),
  lastName: "山田",
  firstName: "花子",
  lastNameKana: "ヤマダ",
  firstNameKana: "ハナコ",
  gender: "FEMALE",
  birthday: "1990-04-01",
  position: "STAFF",
  branchName: "新宿支店",
  email: null,
  phoneNumber: "090-1234-5678",
  emergencyPhoneNumber: null,
  areas: ["EAST"],
  regionCodes: [4],
  prefectureCodes: [13],
  chargerUserIds,
  address: { postCode: TEST_POST_CODE, address1: "1-2-3" },
  jobHistories: [{ hireDate: "2020-04-01", resignationDate: null, resignationReason: null }],
  familyMembers: [
    {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: null,
      firstNameKana: null,
      relation: "HUSBAND",
      birthday: null,
    },
  ],
  memos: [
    { memoType: "STAFF_MEMO", content: "面談済み" },
    { memoType: "ENTRY_EXIT", content: "" },
  ],
  ...overrides,
});
