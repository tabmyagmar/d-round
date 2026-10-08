import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import { contextFor, createHarness, signedInUser, uniqueEmployeeNumber } from "../../support";
import type { TestHarness } from "../../support";

/** The router only wires input → ability → service; these tests prove the wiring and codes. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

/** A valid 姓 / 名 / セイ / メイ for invites. */
const NAMES = {
  lastName: "招待",
  firstName: "太郎",
  lastNameKana: "ショウタイ",
  firstNameKana: "タロウ",
};

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
    const self = await signedInUser(h, { name: "Me Myself" });
    const caller = createCaller(await contextFor(h, self.headers));

    const me = await caller.user.me();

    expect(me.id).toBe(self.user.id);
    expect(me.name).toBe("Me Myself");
  });

  it("maps layer-1 denials to FORBIDDEN before touching the service", async () => {
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, am.headers));

    await expect(caller.user.update({ userId: am.user.id, role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // `requireAbility("status", "User")` words its message differently from the service, so the
    // message proves the denial happened in the router.
    await expect(caller.user.deactivate({ userId: am.user.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not allowed to status User",
    });
  });

  it("denies deactivate at layer 1 to an admin whose `status User` grant a user DENY row removes", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const target = await signedInUser(h);
    // Grants are read at session lookup, so the DENY row goes in before the context is built.
    await h.db.userPermission.create({
      data: { userId: admin.user.id, permissionKey: "1105", effect: "DENY" },
    });
    const caller = createCaller(await contextFor(h, admin.headers));

    await expect(caller.user.deactivate({ userId: target.user.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not allowed to status User",
    });
    expect((await caller.user.byId({ userId: target.user.id })).deletedAt).toBeNull();
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

  it("lets an admin list, change roles and deactivate, and maps conflicts to CONFLICT", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, admin.headers));

    const page = await caller.user.list({ page: 1, perPage: 100 });
    expect(page.items.map((u) => u.id)).toContain(am.user.id);

    const changed = await caller.user.update({ userId: am.user.id, role: "admin" });
    expect(changed.role).toBe("admin");
    await expect(
      caller.user.update({ userId: am.user.id, permissionKeys: ["9999"] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller.user.update({ userId: am.user.id, role: "manager", permissionKeys: ["9999"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(caller.user.deactivate({ userId: admin.user.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const victim = await signedInUser(h);
    const gone = await caller.user.deactivate({ userId: victim.user.id });
    expect(gone.deletedAt).toBeInstanceOf(Date);
  });

  it("reactivates through user.reactivate for a caller holding `status User` only", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const victim = await signedInUser(h);
    const caller = createCaller(await contextFor(h, admin.headers));
    await caller.user.deactivate({ userId: victim.user.id });

    const amCaller = createCaller(await contextFor(h, am.headers));
    await expect(amCaller.user.reactivate({ userId: victim.user.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not allowed to status User",
    });

    const back = await caller.user.reactivate({ userId: victim.user.id });
    expect(back.deletedAt).toBeNull();
    await expect(caller.user.reactivate({ userId: victim.user.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const listed = await caller.user.list({ status: "deactivated", perPage: 100 });
    expect(listed.items.map((u) => u.id)).not.toContain(victim.user.id);
  });

  it("invites through user.invite and re-sends through user.sendPasswordReset for an admin only", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const am = await signedInUser(h);
    const email = `${crypto.randomUUID()}@example.com`;

    const amCaller = createCaller(await contextFor(h, am.headers));
    await expect(amCaller.user.invite({ email, ...NAMES, role: "am" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const caller = createCaller(await contextFor(h, admin.headers));
    const invited = await caller.user.invite({ email, ...NAMES, role: "am" });
    expect(invited.email).toBe(email);

    await expect(caller.user.invite({ email, ...NAMES, role: "am" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      caller.user.invite({ email: "not-an-email", ...NAMES, role: "am" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(caller.user.sendPasswordReset({ userId: invited.id })).resolves.toBeUndefined();
  });

  it("refuses a reading that is not katakana", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const caller = createCaller(await contextFor(h, admin.headers));

    await expect(
      caller.user.invite({
        email: `${crypto.randomUUID()}@example.com`,
        ...NAMES,
        lastNameKana: "しょうたい",
        role: "am",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("user router: profile and 担当者 lookups", () => {
  it("parses an invited profile: region codes distinct and ascending", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const caller = createCaller(await contextFor(h, admin.headers));

    const invited = await caller.user.invite({
      email: `${crypto.randomUUID()}@example.com`,
      ...NAMES,
      role: "am",
      profile: {
        employeeNumber: uniqueEmployeeNumber(),
        departmentName: "東日本営業部",
        position: "SV",
        retirementDate: null,
        areas: ["EAST"],
        regionCodes: [4, 3, 4],
      },
    });

    expect(invited.profile?.regions.map((region) => region.regionCode)).toEqual([3, 4]);
  });

  it("guards chargerOptions and employeeNumberAvailable", async () => {
    const anonymous = createCaller(await contextFor(h));
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );

    await expect(anonymous.user.chargerOptions({ regionCodes: [4] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(admin.user.chargerOptions({ regionCodes: [] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(Array.isArray(await admin.user.chargerOptions({ regionCodes: [4] }))).toBe(true);
    await expect(
      admin.user.employeeNumberAvailable({ employeeNumber: uniqueEmployeeNumber() }),
    ).resolves.toBe(true);
  });
});
