import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceAddresses } from "../../prisma/seed/source-addresses.seed";
import type { SeedSummary } from "../../prisma/seed/support";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// Only this file writes addresses, so the summaries are asserted exactly. The full master is
// loaded once in beforeAll (124,809 CSV rows); the tests read what it left behind.

const LOAD_TIMEOUT = 120_000;
const DISTINCT_POST_CODES = 120_663;
const DUPLICATE_ROWS = 4_146;

let prisma: PrismaClient;
let countBefore: number;
let firstRun: SeedSummary;

beforeAll(async () => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
  // 0 on a fresh container; keeps the created count right when a watch run reuses the container.
  countBefore = await prisma.sourceAddress.count();
  firstRun = await seedSourceAddresses(prisma);
}, LOAD_TIMEOUT);

afterAll(async () => {
  await prisma.$disconnect();
});

const findAddress = (postCode: string) =>
  prisma.sourceAddress.findUniqueOrThrow({ where: { postCode } });

const latestUpdatedAt = async () =>
  (await prisma.sourceAddress.aggregate({ _max: { updatedAt: true } }))._max.updatedAt;

describe("seedSourceAddresses", () => {
  it("loads one row per distinct post code and reports the dropped duplicates", async () => {
    expect(firstRun).toEqual({
      dataset: "source_addresses",
      rows: DISTINCT_POST_CODES,
      created: DISTINCT_POST_CODES - countBefore,
      updated: 0,
      skipped: DUPLICATE_ROWS,
    });
    expect(await prisma.sourceAddress.count()).toBe(DISTINCT_POST_CODES);
  });

  it("converts the legacy cells: integer codes, 0/1 flags to booleans, text kept", async () => {
    expect(await findAddress("0600000")).toMatchObject({
      jisCode: 1101,
      oldPostCode: "60",
      prefKana: "ﾎｯｶｲﾄﾞｳ",
      cityKana: "ｻｯﾎﾟﾛｼﾁｭｳｵｳｸ",
      townKana: "ｲｶﾆｹｲｻｲｶﾞﾅｲﾊﾞｱｲ",
      pref: "北海道",
      city: "札幌市中央区",
      town: "以下に掲載がない場合",
      isTownRepresentedByMultiplePostalCodes: false,
      isHamletNumberingStart: false,
      hasChome: false,
      isPostalCodeForMultipleTownAreas: false,
      updateStatus: 0,
      changeReason: 0,
    });
    expect(await findAddress("0640941")).toMatchObject({ town: "旭ケ丘", hasChome: true });
    expect(await findAddress("3800907")).toMatchObject({
      isTownRepresentedByMultiplePostalCodes: true,
      isHamletNumberingStart: true,
      hasChome: false,
      isPostalCodeForMultipleTownAreas: false,
    });
    expect(await findAddress("8112413")).toMatchObject({
      hasChome: true,
      updateStatus: 1,
      changeReason: 2,
    });
  });

  it("keeps the first CSV row of a repeated post code, as the legacy LOAD DATA did", async () => {
    // 0040000 appears for 札幌市厚別区 and then 札幌市清田区; 0680546 for 南部青葉町, then 南部菊水町.
    expect(await findAddress("0040000")).toMatchObject({
      city: "札幌市厚別区",
      isPostalCodeForMultipleTownAreas: true,
    });
    expect(await findAddress("0680546")).toMatchObject({
      town: "南部青葉町",
      isPostalCodeForMultipleTownAreas: true,
    });
  });

  it(
    "creates and changes nothing on a second run",
    async () => {
      const before = await findAddress("0600000");
      const latestBefore = await latestUpdatedAt();

      const summary = await seedSourceAddresses(prisma);

      expect(summary).toEqual({
        dataset: "source_addresses",
        rows: DISTINCT_POST_CODES,
        created: 0,
        updated: 0,
        skipped: DUPLICATE_ROWS,
      });
      expect(await prisma.sourceAddress.count()).toBe(DISTINCT_POST_CODES);
      expect((await findAddress("0600000")).updatedAt).toEqual(before.updatedAt);
      // No row anywhere in the table was written: the newest updatedAt is still the same.
      expect(await latestUpdatedAt()).toEqual(latestBefore);
    },
    LOAD_TIMEOUT,
  );

  it(
    "re-creates only an address missing from the table on the next run",
    async () => {
      await prisma.sourceAddress.delete({ where: { postCode: "9140044" } });

      const summary = await seedSourceAddresses(prisma);

      expect(summary).toEqual({
        dataset: "source_addresses",
        rows: DISTINCT_POST_CODES,
        created: 1,
        updated: 0,
        skipped: DUPLICATE_ROWS,
      });
      expect(await prisma.sourceAddress.count()).toBe(DISTINCT_POST_CODES);
      expect(await findAddress("9140044")).toMatchObject({
        pref: "福井県",
        city: "敦賀市",
        town: "岡山町",
        updateStatus: 1,
        changeReason: 5,
      });
    },
    LOAD_TIMEOUT,
  );
});
