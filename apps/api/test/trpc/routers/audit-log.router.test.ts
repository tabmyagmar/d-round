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

describe("audit log router", () => {
  it("lets an admin read the log, and refuses a manager and an AM", async () => {
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );
    const manager = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "manager" })).headers),
    );
    const am = createCaller(await contextFor(h, (await signedInUser(h)).headers));

    await expect(admin.auditLog.list({ statuses: ["FAILURE"] })).resolves.toMatchObject({
      page: 1,
      perPage: 20,
    });
    await expect(
      admin.auditLog.history({ entityType: "Client", entityId: crypto.randomUUID() }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    for (const caller of [manager, am]) {
      await expect(caller.auditLog.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.auditLog.byId({ auditLogId: crypto.randomUUID() })).rejects.toMatchObject(
        { code: "FORBIDDEN" },
      );
    }
  });

  it("refuses an unknown action, target type or row", async () => {
    const admin = createCaller(
      await contextFor(h, (await signedInUser(h, { role: "admin" })).headers),
    );

    await expect(admin.auditLog.list({ actions: ["client.remove"] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      admin.auditLog.history({ entityType: "Widget", entityId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.auditLog.byId({ auditLogId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
