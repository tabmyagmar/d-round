import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REQUEST_ID_HEADER, buildRequestContext } from "../../src/core/context";
import { contextFor, createHarness, signedInUser } from "../support";
import type { TestHarness } from "../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const deps = () => ({ logger: h.logger, db: h.db, redis: h.redis, auth: h.auth });

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

  it("resolves the session into a typed user with role and department", async () => {
    const signedIn = await signedInUser(h, { role: "hr_manager", department: "Finance" });

    const ctx = await contextFor(h, signedIn.headers);

    expect(ctx.user).toMatchObject({
      id: signedIn.user.id,
      email: signedIn.email,
      role: "hr_manager",
      department: "Finance",
      emailVerified: true,
    });
    expect(ctx.ability.can("read", "User")).toBe(true);
    expect(ctx.ability.can("changeRole", "User")).toBe(false);
  });

  it("falls back to the default role when the stored role is unknown", async () => {
    const signedIn = await signedInUser(h);
    await h.db.user.update({ where: { id: signedIn.user.id }, data: { role: "ceo" } });

    const ctx = await contextFor(h, signedIn.headers);

    expect(ctx.user?.role).toBe("member");
  });
});
