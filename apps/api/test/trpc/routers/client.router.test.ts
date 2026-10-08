import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import {
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

describe("client router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));

    await expect(anonymous.client.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lets an admin create, read, change the status of and delete a client", async () => {
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );
    const charger = await signedInUser(h);

    const created = await admin.client.create(clientInput([charger.user.id]));
    expect((await admin.client.byId({ clientId: created.id })).id).toBe(created.id);
    await expect(admin.client.numberAvailable({ number: created.number })).resolves.toBe(false);
    expect(
      (await admin.client.options({ search: String(created.number) })).map((client) => client.id),
    ).toEqual([created.id]);
    await expect(admin.client.deleteMany({ clientIds: [created.id] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await admin.client.changeStatus({ clientId: created.id, status: "SUSPENDED" });
    await expect(admin.client.deleteMany({ clientIds: [created.id] })).resolves.toEqual({
      count: 1,
    });
    await expect(admin.client.byId({ clientId: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses an AM's writes and malformed input", async () => {
    const am = await signedInUser(h);
    const caller = createCaller(await contextFor(h, am.headers));
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );

    await expect(caller.client.create(clientInput([am.user.id]))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.client.list({})).resolves.toBeDefined();
    await expect(caller.client.options({})).resolves.toBeDefined();
    await expect(
      admin.client.create({ ...clientInput([am.user.id]), webUrl: "localhost" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
