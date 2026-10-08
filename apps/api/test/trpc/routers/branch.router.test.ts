import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import {
  branchInput,
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
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

const adminCaller = async () =>
  createCaller(await contextFor(h, (await signedInUser(h, { role: "admin" })).headers));

describe("branch router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));

    await expect(anonymous.branch.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lets an admin create, read, change the status of and delete a branch", async () => {
    const admin = await adminCaller();
    const charger = await signedInUser(h);
    const client = await admin.client.create(clientInput([charger.user.id]));

    const created = await admin.branch.create(branchInput(client.id, [charger.user.id]));
    expect((await admin.branch.byId({ branchId: created.id })).id).toBe(created.id);
    await expect(admin.branch.nextNumber({ clientId: client.id })).resolves.toBe(2);
    await expect(
      admin.branch.create(branchInput(client.id, [charger.user.id])),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(admin.branch.deleteMany({ branchIds: [created.id] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await admin.branch.changeStatus({ branchId: created.id, status: "SUSPENDED" });
    await expect(admin.branch.deleteMany({ branchIds: [created.id] })).resolves.toEqual({
      count: 1,
    });
    await expect(admin.branch.byId({ branchId: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses an AM's writes and malformed input", async () => {
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, am.headers));
    const admin = await adminCaller();
    const client = await admin.client.create(clientInput([am.user.id]));

    await expect(caller.branch.create(branchInput(client.id, [am.user.id]))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.branch.list({ clientId: client.id })).resolves.toBeDefined();
    await expect(
      admin.branch.create({ ...branchInput(client.id, [am.user.id]), contactEmail: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
