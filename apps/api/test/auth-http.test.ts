import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EMAIL_TEMPLATES, emailJobId } from "@repo/queue";
import { DEFAULT_ROLE } from "@repo/validation";

import { createApp } from "../src/app";
import type { App } from "../src/app";
import { createRateLimiter } from "../src/middleware/rate-limit";

import { TEST_PASSWORD, TEST_WEB_ORIGIN, cookieHeaderFrom, createHarness } from "./support";
import type { TestHarness } from "./support";

/** Better Auth over the real HTTP surface, with the outbox and the rate limiter. */
let h: TestHarness;
let app: App;

beforeAll(async () => {
  h = await createHarness();
  app = createApp({
    logger: h.logger,
    db: h.db,
    redis: h.redis,
    auth: h.auth,
    webOrigin: TEST_WEB_ORIGIN,
    signInRateLimiter: createRateLimiter(h.redis, {
      keyPrefix: `rl-test-${crypto.randomUUID()}`,
      points: 2,
      durationSeconds: 60,
    }),
  });
});

afterAll(async () => {
  await h.stop();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_WEB_ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

/** Server-side admin call: the only way a user gets created (public sign-up is off). */
const createUser = (email: string, name: string, options: { emailVerified?: boolean } = {}) =>
  h.auth.api.createUser({
    body: {
      email,
      password: TEST_PASSWORD,
      name,
      role: DEFAULT_ROLE,
      ...(options.emailVerified ? { data: { emailVerified: true } } : {}),
    },
  });

describe("POST /api/auth/sign-up/email", () => {
  it("is disabled: answers 400 EMAIL_PASSWORD_SIGN_UP_DISABLED and writes no user row", async () => {
    const email = `${crypto.randomUUID()}@example.com`;

    const response = await post("/api/auth/sign-up/email", {
      name: "Http User",
      email,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" });
    expect(await h.db.user.findUnique({ where: { email } })).toBeNull();
  });
});

describe("POST /api/auth/send-verification-email", () => {
  it("writes the verification mail of an admin-created unverified user to the outbox and enqueues its job", async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    await createUser(email, "Http User");

    const response = await post("/api/auth/send-verification-email", { email });

    expect(response.status).toBe(200);
    const user = await h.db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ role: DEFAULT_ROLE, emailVerified: false });

    const outbox = await h.db.outboxEmail.findMany({ where: { to: email } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ template: EMAIL_TEMPLATES.verification, status: "PENDING" });
    expect(outbox[0]?.payload).toMatchObject({ name: "Http User" });

    const job = await h.emailQueue.getJob(emailJobId(outbox[0]?.id ?? ""));
    expect(job?.data.outboxEmailId).toBe(outbox[0]?.id);
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("issues a session cookie for an admin-created verified user and resolves it on /trpc", async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    await createUser(email, "Verified", { emailVerified: true });

    const signIn = await post(
      "/api/auth/sign-in/email",
      { email, password: TEST_PASSWORD },
      // unique rate-limit key (`clientIp` keys on the raw header)
      { "x-forwarded-for": crypto.randomUUID() },
    );
    expect(signIn.status).toBe(200);
    const cookie = cookieHeaderFrom(signIn);
    expect(cookie).toContain("better-auth.session_token");

    const me = await app.request("/trpc/user.me", { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.text()).toContain(email);
  });

  it("rate limits sign-in attempts per client IP with Retry-After", async () => {
    const ip = "203.0.113.7";
    const attempt = () =>
      post(
        "/api/auth/sign-in/email",
        { email: "nobody@example.com", password: "wrong-password-1" },
        { "x-forwarded-for": ip },
      );

    const first = await attempt();
    const second = await attempt();
    const third = await attempt();

    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);

    // Other clients are unaffected.
    const other = await post(
      "/api/auth/sign-in/email",
      { email: "nobody@example.com", password: "wrong-password-1" },
      { "x-forwarded-for": "203.0.113.8" },
    );
    expect(other.status).not.toBe(429);
  });
});
