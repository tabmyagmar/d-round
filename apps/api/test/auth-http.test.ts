import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuth } from "@repo/auth";
import type { Prisma } from "@repo/database";
import { EMAIL_TEMPLATES, emailJobId } from "@repo/queue";
import { DEFAULT_ROLE } from "@repo/validation";

import { createApp } from "../src/app";
import type { App } from "../src/app";
import { createRateLimiter } from "../src/middleware/rate-limit";

import {
  TEST_PASSWORD,
  TEST_WEB_ORIGIN,
  contextDeps,
  cookieHeaderFrom,
  createHarness,
  signedInUser,
} from "./support";
import type { TestHarness } from "./support";

/** Better Auth over the real HTTP surface, with the outbox and the rate limiter. */
let h: TestHarness;
let app: App;

beforeAll(async () => {
  h = await createHarness();
  app = createApp({
    ...contextDeps(h),
    signInRateLimiter: createRateLimiter(h.redis, {
      keyPrefix: `rl-test-${crypto.randomUUID()}`,
      points: 2,
      durationSeconds: 60,
    }),
    passwordResetRateLimiter: createRateLimiter(h.redis, {
      keyPrefix: `rl-reset-test-${crypto.randomUUID()}`,
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

describe("POST /api/auth/request-password-reset", () => {
  const redirectTo = `${TEST_WEB_ORIGIN}/new-password`;
  /** Each request from its own client IP, so the reset rate limit stays out of these cases. */
  const requestReset = (email: string) =>
    post(
      "/api/auth/request-password-reset",
      { email, redirectTo },
      { "x-forwarded-for": `198.51.100.${String(Math.floor(Math.random() * 250) + 1)}` },
    );
  const outboxFor = (to: string) => h.db.outboxEmail.findMany({ where: { to } });

  it("mails a password reset to a user who has a password", async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    await createUser(email, "Has Password", { emailVerified: true });

    const response = await requestReset(email);

    expect(response.status).toBe(200);
    const rows = await outboxFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ template: EMAIL_TEMPLATES.passwordReset, status: "PENDING" });
    expect(rows[0]?.payload).toMatchObject({ name: "Has Password" });
    const job = await h.emailQueue.getJob(emailJobId(rows[0]?.id ?? ""));
    expect(job?.data.outboxEmailId).toBe(rows[0]?.id);
  });

  it("mails an invitation to a user an admin created without a password", async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    await h.auth.api.createUser({ body: { email, name: "Invitee", role: DEFAULT_ROLE } });

    const response = await requestReset(email);

    expect(response.status).toBe(200);
    const rows = await outboxFor(email);
    expect(rows.map((row) => row.template)).toEqual([EMAIL_TEMPLATES.accountInvitation]);
  });

  it("answers an unknown address exactly like a known one and writes nothing", async () => {
    const known = `${crypto.randomUUID()}@example.com`;
    await createUser(known, "Known", { emailVerified: true });
    const unknown = `${crypto.randomUUID()}@example.com`;

    const knownResponse = await requestReset(known);
    const unknownResponse = await requestReset(unknown);

    expect(unknownResponse.status).toBe(knownResponse.status);
    expect(await unknownResponse.json()).toEqual(await knownResponse.json());
    expect(await outboxFor(unknown)).toHaveLength(0);
  });

  it("rate limits reset requests per client IP with Retry-After", async () => {
    const attempt = () =>
      post(
        "/api/auth/request-password-reset",
        { email: "nobody@example.com", redirectTo },
        { "x-forwarded-for": "203.0.113.42" },
      );

    expect((await attempt()).status).not.toBe(429);
    expect((await attempt()).status).not.toBe(429);
    const third = await attempt();
    expect(third.status).toBe(429);
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("Better Auth's events in the audit log (ADR 0015)", () => {
  const BROWSER = "Mozilla/5.0 (audit test)";
  const redirectTo = `${TEST_WEB_ORIGIN}/new-password`;
  const rowsWhere = (where: Prisma.AuditLogWhereInput) =>
    h.db.auditLog.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const signIn = (email: string, password: string, ip: string) =>
    post(
      "/api/auth/sign-in/email",
      { email, password },
      { "x-forwarded-for": ip, "user-agent": BROWSER },
    );
  const verifiedUser = async (name: string) => {
    const email = `${crypto.randomUUID()}@example.com`;
    await createUser(email, name, { emailVerified: true });
    return h.db.user.findUniqueOrThrow({ where: { email } });
  };

  it("records a sign-in with the user, the client's address, the browser and the request id", async () => {
    const user = await verifiedUser("監査 一郎");

    const response = await signIn(user.email, TEST_PASSWORD, "192.0.2.11");

    expect(response.status).toBe(200);
    expect(await rowsWhere({ actorId: user.id })).toEqual([
      expect.objectContaining({
        actorType: "USER",
        actorName: "監査 一郎",
        actorEmail: user.email,
        actorRole: DEFAULT_ROLE,
        action: "auth.signIn",
        entityType: "User",
        entityId: user.id,
        status: "SUCCESS",
        ipAddress: "192.0.2.11",
        userAgent: BROWSER,
        requestId: response.headers.get("x-request-id"),
      }),
    ]);
  });

  it("records a refused sign-in by the typed address and its code, never the password", async () => {
    const user = await verifiedUser("Refused");

    const response = await signIn(user.email, "wrong-password-9", "192.0.2.12");

    expect(response.status).toBe(401);
    const rows = await rowsWhere({ actorEmail: user.email, action: "auth.signIn" });
    expect(rows).toEqual([
      expect.objectContaining({
        actorType: "ANONYMOUS",
        actorId: null,
        entityLabel: user.email,
        status: "FAILURE",
        errorCode: "INVALID_EMAIL_OR_PASSWORD",
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("wrong-password-9");
  });

  it("records a sign-out with the user who signed out", async () => {
    const user = await verifiedUser("Signing Out");
    const cookie = cookieHeaderFrom(await signIn(user.email, TEST_PASSWORD, "192.0.2.13"));

    const response = await post(
      "/api/auth/sign-out",
      {},
      { cookie, "x-forwarded-for": "192.0.2.13" },
    );

    expect(response.status).toBe(200);
    expect((await rowsWhere({ actorId: user.id })).map((row) => row.action)).toEqual([
      "auth.signIn",
      "auth.signOut",
    ]);
  });

  it("records a refused and a done password change with the signed-in user", async () => {
    const user = await verifiedUser("Changing");
    const cookie = cookieHeaderFrom(await signIn(user.email, TEST_PASSWORD, "192.0.2.14"));
    const change = (currentPassword: string, newPassword: string) =>
      post(
        "/api/auth/change-password",
        { currentPassword, newPassword, revokeOtherSessions: true },
        { cookie, "x-forwarded-for": "192.0.2.14" },
      );

    expect((await change("wrong-current-1", "NewPassw0rd1")).status).toBe(400);
    expect((await change(TEST_PASSWORD, "NewPassw0rd2")).status).toBe(200);

    const rows = await rowsWhere({ actorId: user.id, action: "auth.changePassword" });
    expect(rows.map((row) => [row.status, row.errorCode])).toEqual([
      ["FAILURE", "INVALID_PASSWORD"],
      ["SUCCESS", null],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/wrong-current-1|NewPassw0rd/);
  });

  it("records a forgotten-password request by the typed address, known or not", async () => {
    const unknown = `${crypto.randomUUID()}@example.com`;

    const response = await post(
      "/api/auth/request-password-reset",
      { email: unknown, redirectTo },
      { "x-forwarded-for": "192.0.2.15" },
    );

    expect(response.status).toBe(200);
    expect(await rowsWhere({ actorEmail: unknown })).toEqual([
      expect.objectContaining({
        actorType: "ANONYMOUS",
        action: "auth.requestPasswordReset",
        status: "SUCCESS",
      }),
    ]);
  });

  it("records a password set from a mailed link with its user, and a link used twice", async () => {
    const user = await verifiedUser("Resetting");
    await post(
      "/api/auth/request-password-reset",
      { email: user.email, redirectTo },
      { "x-forwarded-for": "192.0.2.16" },
    );
    const mail = await h.db.outboxEmail.findFirstOrThrow({ where: { to: user.email } });
    const token = /\/reset-password\/([^?/]+)/.exec(JSON.stringify(mail.payload))?.[1] ?? "";
    const reset = () =>
      post(
        "/api/auth/reset-password",
        { newPassword: "Reset1234x", token },
        { "x-forwarded-for": "192.0.2.16" },
      );

    expect((await reset()).status).toBe(200);
    expect((await reset()).status).toBe(400);

    expect(await rowsWhere({ action: "auth.resetPassword", actorId: user.id })).toEqual([
      expect.objectContaining({ status: "SUCCESS", entityId: user.id }),
    ]);
    const refused = await rowsWhere({
      action: "auth.resetPassword",
      status: "FAILURE",
      ipAddress: "192.0.2.16",
    });
    expect(refused).toEqual([
      expect.objectContaining({ actorType: "ANONYMOUS", errorCode: "INVALID_TOKEN" }),
    ]);
    expect(JSON.stringify(refused)).not.toContain(token);
  });

  it("records an admin endpoint called over HTTP with its target and the role it gives", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const target = await verifiedUser("昇格 対象");
    const setRole = (cookie: string) =>
      post(
        "/api/auth/admin/set-role",
        { userId: target.id, role: "manager" },
        { cookie, "x-forwarded-for": "192.0.2.17" },
      );

    expect((await setRole(admin.headers.get("cookie") ?? "")).status).toBe(200);
    expect((await setRole(am.headers.get("cookie") ?? "")).status).toBe(403);

    const rows = await rowsWhere({ action: "auth.admin", entityId: target.id });
    expect(rows).toEqual([
      expect.objectContaining({
        actorId: admin.user.id,
        entityLabel: "昇格 対象",
        status: "SUCCESS",
        changes: [
          { field: "endpoint", before: null, after: "/admin/set-role" },
          { field: "role", before: null, after: "manager" },
        ],
      }),
      expect.objectContaining({ actorId: am.user.id, status: "FAILURE" }),
    ]);
  });

  it("records nothing for Better Auth calls a service makes on the server", async () => {
    const someone = await signedInUser(h);

    expect(
      await rowsWhere({ OR: [{ actorId: someone.user.id }, { entityId: someone.user.id }] }),
    ).toEqual([]);
  });

  it("answers exactly as before when the recorder fails", async () => {
    const failing = createAuth({
      prisma: h.db,
      secret: "test-secret-test-secret-test-secret-1234",
      baseURL: "http://localhost:4000",
      trustedOrigins: [TEST_WEB_ORIGIN],
      sendVerificationEmail: () => Promise.resolve(),
      sendPasswordResetEmail: () => Promise.resolve(),
      onAuthEvent: () => Promise.reject(new Error("the audit log is down")),
    });
    const user = await verifiedUser("Unrecorded");

    const response = await failing.handler(
      new Request("http://localhost:4000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: TEST_WEB_ORIGIN },
        body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
      }),
    );

    expect(response.status).toBe(200);
    expect(cookieHeaderFrom(response)).toContain("better-auth.session_token");
  });
});
