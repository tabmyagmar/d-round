import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";

// Other seed test files (prefectures, the whole reference entrypoint) seed the same regions on
// the shared container in parallel, so the first run's created/updated split is not asserted —
// only the data it leaves behind and that a re-run changes nothing.

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const findRegions = () => prisma.sourceRegion.findMany({ orderBy: { code: "asc" } });

describe("seedSourceRegions", () => {
  it("loads the nine legacy regions, EAST for codes 1-4 and WEST for 5-9", async () => {
    const summary = await seedSourceRegions(prisma);

    expect(summary).toMatchObject({ dataset: "source_regions", rows: 9, skipped: 0 });
    const regions = await findRegions();
    expect(regions.map((region) => region.code)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(regions.map((region) => region.area)).toEqual([
      "EAST",
      "EAST",
      "EAST",
      "EAST",
      "WEST",
      "WEST",
      "WEST",
      "WEST",
      "WEST",
    ]);
    expect(regions[0]).toMatchObject({ code: 1, name: "北海道", nameEn: "Hokkaido" });
  });

  it("changes nothing on a second run", async () => {
    await seedSourceRegions(prisma);
    const before = await findRegions();

    const summary = await seedSourceRegions(prisma);

    expect(summary).toEqual({
      dataset: "source_regions",
      rows: 9,
      created: 0,
      updated: 0,
      skipped: 0,
    });
    const after = await findRegions();
    expect(after).toHaveLength(9);
    expect(after.map((region) => [region.code, region.updatedAt])).toEqual(
      before.map((region) => [region.code, region.updatedAt]),
    );
  });

  it("restores a region whose values drifted from the CSV without creating rows", async () => {
    await seedSourceRegions(prisma);
    await prisma.sourceRegion.update({
      where: { code: 9 },
      data: { name: "stale", nameEn: "Stale", area: "EAST" },
    });

    const summary = await seedSourceRegions(prisma);

    expect(summary.created).toBe(0);
    expect(await prisma.sourceRegion.count()).toBe(9);
    expect(await prisma.sourceRegion.findUniqueOrThrow({ where: { code: 9 } })).toMatchObject({
      name: "九州",
      nameEn: "Kyushu",
      area: "WEST",
    });
  });
});
