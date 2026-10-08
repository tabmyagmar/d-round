import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createSourceRepository } from "../../src/repositories/source.repository";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
  // Idempotent and safe in parallel with the regions seed test (it asserts restored values only).
  await seedSourceRegions(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Thrown at the end of a scenario so its rows roll back: the prefecture and address seed tests run
 * in parallel on the same container and assert exact counts and summaries.
 */
const ROLLBACK = new Error("rollback: scenario finished");

describe("source repository", () => {
  it("lists the regions in code order with their area", async () => {
    const regions = await createSourceRepository(prisma).findRegions();

    expect(regions).toHaveLength(9);
    expect(regions[0]).toEqual({ code: 1, name: "北海道", area: "EAST" });
    expect(regions.map((region) => region.code)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("lists prefectures in code order with their region, and finds an address by post code", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.sourcePrefecture.createMany({
          data: [
            { code: 91, name: "テスト県B", nameEn: "Test B", regionCode: 9 },
            { code: 90, name: "テスト県A", nameEn: "Test A", regionCode: 4 },
          ],
        });
        await tx.sourceAddress.create({
          data: {
            jisCode: 1101,
            postCode: "0009999",
            pref: "北海道",
            city: "札幌市",
            town: "テスト町",
          },
        });
        const repo = createSourceRepository(tx);

        const prefectures = (await repo.findPrefectures()).filter((p) => p.code >= 90);
        expect(prefectures).toEqual([
          { code: 90, name: "テスト県A", regionCode: 4 },
          { code: 91, name: "テスト県B", regionCode: 9 },
        ]);
        expect(await repo.findAddressByPostCode("0009999")).toEqual({
          postCode: "0009999",
          pref: "北海道",
          city: "札幌市",
          town: "テスト町",
        });
        expect(await repo.findAddressByPostCode("0009998")).toBeNull();
        throw ROLLBACK;
      }),
    ).rejects.toBe(ROLLBACK);
  });
});
