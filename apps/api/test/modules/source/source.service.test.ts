import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ForbiddenError, ValidationError } from "../../../src/core/errors";
import * as sourceService from "../../../src/modules/source/source.service";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

// The harness database carries the seeded regions and prefectures (`seedReferenceData`), never the
// post-code master, so each address test inserts the row it looks up.

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const signedInContext = async () => contextFor(h, (await signedInUser(h)).headers);

/** A seven-digit post code no other test uses. */
const uniquePostCode = (): string =>
  String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");

describe("source service", () => {
  it("lists the nine regions with their area and the 47 prefectures with their region", async () => {
    const ctx = await signedInContext();

    const regions = await sourceService.regions(ctx);
    const prefectures = await sourceService.prefectures(ctx);

    expect(regions).toHaveLength(9);
    expect(regions[0]).toEqual({ code: 1, name: "北海道", area: "EAST" });
    expect(regions.at(-1)).toEqual({ code: 9, name: "九州", area: "WEST" });
    expect(prefectures).toHaveLength(47);
    expect(prefectures[12]).toEqual({ code: 13, name: "東京都", regionCode: 4 });
    const regionCodes = new Set(regions.map((region) => region.code));
    expect(prefectures.every((prefecture) => regionCodes.has(prefecture.regionCode))).toBe(true);
  });

  it("finds the address parts of a post code, and nothing for an unknown one", async () => {
    const ctx = await signedInContext();
    const postCode = uniquePostCode();
    await h.db.sourceAddress.create({
      data: { jisCode: 13101, postCode, pref: "東京都", city: "千代田区", town: "千代田" },
    });

    expect(await sourceService.addressByPostCode(ctx, postCode)).toEqual({
      postCode,
      pref: "東京都",
      city: "千代田区",
      town: "千代田",
    });
    expect(await sourceService.addressByPostCode(ctx, uniquePostCode())).toBeNull();
  });

  it("lets a write name known codes and refuses unknown regions, prefectures and post codes", async () => {
    const postCode = uniquePostCode();
    await h.db.sourceAddress.create({
      data: { jisCode: 13101, postCode, pref: "東京都", city: "千代田区", town: "千代田" },
    });

    await expect(
      sourceService.assertKnownSource(h.db, { regionCodes: [4], prefectureCodes: [13], postCode }),
    ).resolves.toBeUndefined();
    await expect(sourceService.assertKnownSource(h.db, {})).resolves.toBeUndefined();
    await expect(
      sourceService.assertKnownSource(h.db, { regionCodes: [4, 99], prefectureCodes: [98] }),
    ).rejects.toThrow(new ValidationError("Unknown region 99, prefecture 98"));
    await expect(
      sourceService.assertKnownSource(h.db, { postCode: uniquePostCode() }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses an anonymous context", async () => {
    const anonymous = await contextFor(h);

    await expect(sourceService.regions(anonymous)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(sourceService.addressByPostCode(anonymous, "1000001")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
