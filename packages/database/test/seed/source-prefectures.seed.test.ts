import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourcePrefectures } from "../../prisma/seed/source-prefectures.seed";
import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// The regions test seeds the same regions on the shared container in parallel, so the first run's
// created/updated split is not asserted, only the data it leaves behind and that a re-run changes
// nothing. Only this file writes prefectures, so the drift test asserts its exact summary.

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const seedRegionsAndPrefectures = async () => {
  await seedSourceRegions(prisma);
  return seedSourcePrefectures(prisma);
};

const findPrefectures = () =>
  prisma.sourcePrefecture.findMany({ include: { region: true }, orderBy: { code: "asc" } });

const countByRegion = (prefectures: readonly { regionCode: number }[]): Record<number, number> => {
  const counts: Record<number, number> = {};
  for (const { regionCode } of prefectures) {
    counts[regionCode] = (counts[regionCode] ?? 0) + 1;
  }
  return counts;
};

describe("seedSourcePrefectures", () => {
  it("loads the 47 legacy prefectures, each linked to its region by code", async () => {
    const summary = await seedRegionsAndPrefectures();

    expect(summary).toMatchObject({ dataset: "source_prefectures", rows: 47, skipped: 0 });
    const prefectures = await findPrefectures();
    expect(prefectures).toHaveLength(47);
    expect(prefectures.map((prefecture) => prefecture.region)).not.toContain(null);
    expect(
      prefectures.filter((prefecture) => prefecture.region.code !== prefecture.regionCode),
    ).toEqual([]);
    expect(countByRegion(prefectures)).toEqual({
      1: 1,
      2: 6,
      3: 4,
      4: 3,
      5: 4,
      6: 6,
      7: 6,
      8: 8,
      9: 9,
    });
    const byCode = new Map(prefectures.map((prefecture) => [prefecture.code, prefecture]));
    expect(byCode.get(13)).toMatchObject({ name: "東京都", nameEn: "Tokyo", regionCode: 4 });
    // Legacy data puts 山口県 in 九州 (region 9), not 中四国; ported unchanged (ADR 0005).
    expect(byCode.get(35)).toMatchObject({ name: "山口県", regionCode: 9 });
  });

  it("changes nothing on a second run", async () => {
    await seedRegionsAndPrefectures();
    const before = await findPrefectures();

    const summary = await seedSourcePrefectures(prisma);

    expect(summary).toEqual({
      dataset: "source_prefectures",
      rows: 47,
      created: 0,
      updated: 0,
      skipped: 0,
    });
    const after = await findPrefectures();
    expect(after).toHaveLength(47);
    expect(after.map((prefecture) => [prefecture.code, prefecture.updatedAt])).toEqual(
      before.map((prefecture) => [prefecture.code, prefecture.updatedAt]),
    );
  });

  it("restores a prefecture whose values drifted from the CSV without creating rows", async () => {
    await seedRegionsAndPrefectures();
    await prisma.sourcePrefecture.update({
      where: { code: 47 },
      data: { name: "stale", nameEn: "Stale", regionCode: 1 },
    });

    const summary = await seedSourcePrefectures(prisma);

    expect(summary).toEqual({
      dataset: "source_prefectures",
      rows: 47,
      created: 0,
      updated: 1,
      skipped: 0,
    });
    expect(await prisma.sourcePrefecture.count()).toBe(47);
    expect(await prisma.sourcePrefecture.findUniqueOrThrow({ where: { code: 47 } })).toMatchObject({
      name: "沖縄県",
      nameEn: "Okinawa Prefecture",
      regionCode: 9,
    });
  });
});
