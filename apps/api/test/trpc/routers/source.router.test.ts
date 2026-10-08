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

describe("source router", () => {
  it("requires a session", async () => {
    const anonymous = createCaller(await contextFor(h));

    await expect(anonymous.source.regions()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.source.prefectures()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("serves an AM the regions, the prefectures and a post-code lookup written with a hyphen", async () => {
    const caller = createCaller(await contextFor(h, (await signedInUser(h)).headers));
    await h.db.sourceAddress.upsert({
      where: { postCode: "0600001" },
      update: {},
      create: {
        jisCode: 1101,
        postCode: "0600001",
        pref: "北海道",
        city: "札幌市中央区",
        town: "北一条西",
      },
    });

    expect(await caller.source.regions()).toHaveLength(9);
    expect(await caller.source.prefectures()).toHaveLength(47);
    expect(await caller.source.addressByPostCode({ postCode: "060-0001" })).toEqual({
      postCode: "0600001",
      pref: "北海道",
      city: "札幌市中央区",
      town: "北一条西",
    });
  });

  it("refuses a malformed post code before the service runs", async () => {
    const caller = createCaller(await contextFor(h, (await signedInUser(h)).headers));

    await expect(caller.source.addressByPostCode({ postCode: "12-34567" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
