import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("permission router", () => {
  it("serves the catalog to a caller holding `changeRole User` only", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const staff = await signedInUser(h);

    const staffCaller = createCaller(await contextFor(h, staff.headers));
    await expect(staffCaller.permission.catalog()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not allowed to changeRole User",
    });

    const groups = await createCaller(await contextFor(h, admin.headers)).permission.catalog();
    expect(groups.map((group) => group.key)).toContain("1100");
  });
});
