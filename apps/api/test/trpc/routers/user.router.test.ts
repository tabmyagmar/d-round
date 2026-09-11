import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

/** The router only wires input → ability → service; these tests prove the wiring and codes. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("user router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));
    await expect(anonymous.user.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns the caller for user.me", async () => {
    const member = await signedInUser(h, { name: "Me Myself" });
    const caller = createCaller(await contextFor(h, member.headers));

    const me = await caller.user.me();

    expect(me.id).toBe(member.user.id);
    expect(me.name).toBe("Me Myself");
  });

  it("maps layer-1 denials to FORBIDDEN before touching the service", async () => {
    const member = await signedInUser(h);
    const caller = createCaller(await contextFor(h, member.headers));

    await expect(
      caller.user.changeRole({ userId: member.user.id, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.user.deactivate({ userId: member.user.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("validates input with the shared schemas", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const caller = createCaller(await contextFor(h, admin.headers));

    await expect(caller.user.byId({ userId: "not-a-uuid" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.user.list({ page: 1, perPage: 1000 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lets an admin list and change roles, and maps service conflicts to CONFLICT", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const member = await signedInUser(h);
    const caller = createCaller(await contextFor(h, admin.headers));

    const page = await caller.user.list({ page: 1, perPage: 100 });
    expect(page.items.map((u) => u.id)).toContain(member.user.id);

    const changed = await caller.user.changeRole({ userId: member.user.id, role: "dept_head" });
    expect(changed.role).toBe("dept_head");

    await expect(caller.user.deactivate({ userId: admin.user.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
