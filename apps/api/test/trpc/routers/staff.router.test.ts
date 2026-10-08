import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import {
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
} from "../../support";
import type { TestHarness } from "../../support";

/** The router only wires input → ability → service; these tests prove the wiring and codes. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

describe("staff router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));

    await expect(anonymous.staff.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lets an admin create, read, change the status of and delete a staff", async () => {
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );
    const charger = await signedInUser(h, { profile: {} });

    const created = await admin.staff.create(staffInput([charger.user.id]));
    expect((await admin.staff.byId({ staffId: created.id })).id).toBe(created.id);
    await expect(
      admin.staff.employeeNumberAvailable({ employeeNumber: created.employeeNumber }),
    ).resolves.toBe(false);
    expect(
      (await admin.staff.byCharger({ userId: charger.user.id })).map((staff) => staff.id),
    ).toContain(created.id);
    await expect(admin.staff.deleteMany({ staffIds: [created.id] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await admin.staff.changeStatus({ staffId: created.id, status: "SUSPENDED" });
    await expect(admin.staff.deleteMany({ staffIds: [created.id] })).resolves.toEqual({ count: 1 });
    await expect(admin.staff.byId({ staffId: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses an AM's writes and malformed input", async () => {
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, am.headers));
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );

    await expect(caller.staff.create(staffInput([am.user.id]))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.staff.list({})).resolves.toBeDefined();
    await expect(
      admin.staff.create({ ...staffInput([am.user.id]), phoneNumber: "12" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
