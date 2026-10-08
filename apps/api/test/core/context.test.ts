import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { SessionUser } from "@repo/auth";
import { prismaUserSubject } from "@repo/permissions/server";
import { DEFAULT_ROLE } from "@repo/validation";

import { REQUEST_ID_HEADER, buildRequestContext, toAuthUser } from "../../src/core/context";
import {
  TEST_PASSWORD,
  contextFor,
  cookieHeaderFrom,
  createHarness,
  signedInUser,
  TEST_WEB_ORIGIN,
} from "../support";
import type { TestHarness } from "../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const deps = () => ({
  logger: h.logger,
  db: h.db,
  redis: h.redis,
  auth: h.auth,
  webOrigin: TEST_WEB_ORIGIN,
});

describe("buildRequestContext", () => {
  it("prefers the explicit request id, then the header, then generates one", async () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: "from-header" });

    expect((await buildRequestContext({ headers, requestId: "explicit" }, deps())).requestId).toBe(
      "explicit",
    );
    expect((await buildRequestContext({ headers }, deps())).requestId).toBe("from-header");
    expect((await buildRequestContext({ headers: new Headers() }, deps())).requestId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("is anonymous without a session cookie and nothing is allowed", async () => {
    const ctx = await contextFor(h);

    expect(ctx.user).toBeNull();
    expect(ctx.ability.can("read", "User")).toBe(false);
  });

  it("resolves the session into a typed user with its role", async () => {
    const signedIn = await signedInUser(h, { role: "am" });

    const ctx = await contextFor(h, signedIn.headers);

    expect(ctx.user).toMatchObject({
      id: signedIn.user.id,
      email: signedIn.email,
      role: "am",
      emailVerified: true,
    });
    expect(ctx.ability.can("read", "User")).toBe(true);
    expect(ctx.ability.can("changeRole", "User")).toBe(false);
  });

  it("mirrors the role's grants from role_permissions in ctx.user.permissions", async () => {
    const signedIn = await signedInUser(h, { role: "am" });
    const rows = await h.db.rolePermission.findMany({
      where: { roleKey: "am" },
      include: { permission: true },
      orderBy: { permissionKey: "asc" },
    });
    const expected = rows.map(({ permission }) => ({
      action: permission.action,
      subject: permission.modelName,
    }));
    expect(expected).toHaveLength(8);

    const ctx = await contextFor(h, signedIn.headers);

    expect(ctx.user?.permissions).toEqual(expected);
  });

  it("resolves a user created without a role to the default role", async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    await h.auth.api.createUser({
      body: { email, password: TEST_PASSWORD, name: "No role", data: { emailVerified: true } },
    });
    const response = await h.auth.api.signInEmail({
      body: { email, password: TEST_PASSWORD },
      asResponse: true,
    });

    const ctx = await contextFor(h, new Headers({ cookie: cookieHeaderFrom(response) }));

    expect(ctx.user?.role).toBe(DEFAULT_ROLE);
  });
});

describe("ctx.ability is built from the session's grants", () => {
  it("lets an admin create users, change their status and their role (rows 1101, 1105, 1106)", async () => {
    const admin = await signedInUser(h, { role: "admin" });

    const ctx = await contextFor(h, admin.headers);

    expect(ctx.ability.can("create", "User")).toBe(true);
    expect(ctx.ability.can("status", "User")).toBe(true);
    expect(ctx.ability.can("changeRole", "User")).toBe(true);
  });

  it("refuses those to an AM, who may still read clients (row 1202)", async () => {
    const am = await signedInUser(h, { role: "am" });

    const ctx = await contextFor(h, am.headers);

    expect(ctx.ability.can("create", "User")).toBe(false);
    expect(ctx.ability.can("status", "User")).toBe(false);
    expect(ctx.ability.can("changeRole", "User")).toBe(false);
    expect(ctx.ability.can("read", "Client")).toBe(true);
  });

  it("keeps the self rule: an AM reads and updates their own row, not another user's", async () => {
    const am = await signedInUser(h, { role: "am" });
    const other = await h.db.user.create({
      data: { name: "Other", email: `${crypto.randomUUID()}@example.com` },
    });

    const ctx = await contextFor(h, am.headers);

    expect(ctx.ability.can("read", prismaUserSubject(am.user))).toBe(true);
    expect(ctx.ability.can("update", prismaUserSubject(am.user))).toBe(true);
    expect(ctx.ability.can("read", prismaUserSubject(other))).toBe(false);
    expect(ctx.ability.can("update", prismaUserSubject(other))).toBe(false);
  });
});

describe("toAuthUser", () => {
  // The database refuses a role outside the catalog (users.role → roles.key), so this fallback
  // is a type guard for the session shape, not a reachable database state.
  it("falls back to the default role when the session carries a role outside the set", () => {
    const sessionUser: SessionUser = {
      id: crypto.randomUUID(),
      name: "Test User",
      email: "ceo@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: "ceo",
      banned: null,
      permissions: [],
    };

    expect(toAuthUser(sessionUser).role).toBe(DEFAULT_ROLE);
  });
});
