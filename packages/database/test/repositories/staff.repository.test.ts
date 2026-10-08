import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createStaffRepository } from "../../src/repositories/staff.repository";
import type { StaffWrite } from "../../src/repositories/staff.repository";
import type { TransactionClient } from "../../src/utils/transaction";

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = createPrismaClient({ connectionString: inject("databaseUrl") });
  // Idempotent and safe in parallel with the regions seed test (it asserts restored values only).
  await seedSourceRegions(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Thrown at the end of every scenario so nothing persists. */
const ROLLBACK = new Error("rollback: scenario finished");

/**
 * Runs a scenario inside a transaction that always rolls back: the prefecture and address seed
 * tests on the same container assert exact counts, so the rows a staff needs (two prefectures, a
 * post code, the 担当者) exist only inside it.
 */
const scenario = async (run: (tx: TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.sourcePrefecture.createMany({
        data: [
          { code: 90, name: "テスト県A", nameEn: "Test A", regionCode: 4 },
          { code: 91, name: "テスト県B", nameEn: "Test B", regionCode: 7 },
        ],
      });
      await tx.sourceAddress.create({
        data: {
          jisCode: 13101,
          postCode: "0009991",
          pref: "東京都",
          city: "千代田区",
          town: "テスト",
        },
      });
      await run(tx);
      throw ROLLBACK;
    }),
  ).rejects.toBe(ROLLBACK);
};

const createUser = (tx: TransactionClient, name: string) =>
  tx.user.create({ data: { name, email: `${crypto.randomUUID()}@example.com` } });

const write = (overrides: Partial<StaffWrite> & { employeeNumber?: number } = {}): StaffWrite => ({
  fields: {
    employeeType: "FULL_TIME",
    employeeNumber: overrides.employeeNumber ?? 10_000 + Math.floor(Math.random() * 1_000_000_000),
    lastName: "山田",
    firstName: "花子",
    lastNameKana: "ヤマダ",
    firstNameKana: "ハナコ",
    gender: "FEMALE",
    birthday: new Date("1990-04-01"),
    position: "STAFF",
    branchName: "新宿支店",
    email: null,
    phoneNumber: "090-1234-5678",
    emergencyPhoneNumber: null,
    areas: ["EAST"],
  },
  address: { postCode: "0009991", address1: "1-2-3" },
  regionCodes: [4],
  prefectureCodes: [90],
  chargerUserIds: [],
  familyMembers: [
    {
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: null,
      firstNameKana: null,
      relation: "HUSBAND",
      birthday: null,
    },
    {
      lastName: "山田",
      firstName: "一郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "イチロウ",
      relation: "ELDEST_SON",
      birthday: new Date("2015-05-05"),
    },
  ],
  memos: [
    { memoType: "STAFF_MEMO", content: "面談済み" },
    { memoType: "CUSTOM", content: "自由メモ" },
  ],
  jobHistories: [
    {
      hireDate: new Date("2020-04-01"),
      resignationDate: new Date("2021-03-31"),
      resignationReason: "転居",
    },
    { hireDate: new Date("2022-04-01"), resignationDate: null, resignationReason: null },
  ],
  ...overrides,
});

describe("staff repository", () => {
  it("creates a staff with its address, codes, 担当者 and lists, read back in order", async () => {
    await scenario(async (tx) => {
      const repo = createStaffRepository(tx);
      const charger = await createUser(tx, "担当 一郎");

      const { id } = await repo.create(write({ chargerUserIds: [charger.id] }));
      const staff = await repo.findById(id);

      expect(staff).toMatchObject({ lastName: "山田", gender: "FEMALE", status: "ACTIVE" });
      expect(staff?.address).toMatchObject({
        postCode: "0009991",
        address1: "1-2-3",
        sourceAddress: { pref: "東京都", city: "千代田区", town: "テスト" },
      });
      expect(staff?.regions.map((region) => region.region.name)).toEqual(["南関東"]);
      expect(staff?.prefectures.map((prefecture) => prefecture.prefecture.name)).toEqual([
        "テスト県A",
      ]);
      expect(staff?.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
      expect(staff?.familyMembers.map((member) => member.firstName)).toEqual(["太郎", "一郎"]);
      expect(staff?.memos.map((memo) => memo.memoType)).toEqual(["STAFF_MEMO", "CUSTOM"]);
      expect(staff?.jobHistories.map((job) => job.hireDate)).toEqual([
        new Date("2020-04-01"),
        new Date("2022-04-01"),
      ]);
    });
  });

  it("replaces the codes and lists, and moves 担当者 by closing and adding", async () => {
    await scenario(async (tx) => {
      const repo = createStaffRepository(tx);
      const before = await createUser(tx, "前任");
      const after = await createUser(tx, "後任");
      const { id } = await repo.create(write({ chargerUserIds: [before.id] }));

      await repo.updateFields(
        id,
        { ...write().fields, branchName: "渋谷支店" },
        {
          postCode: "0009991",
          address1: "4-5-6",
        },
      );
      await repo.replaceRegions(id, [7]);
      await repo.replacePrefectures(id, [91]);
      await repo.replaceFamilyMembers(id, []);
      await repo.replaceMemos(id, [{ memoType: "INSURANCE", content: "加入" }]);
      await repo.replaceJobHistories(id, [
        { hireDate: new Date("2023-01-01"), resignationDate: null, resignationReason: null },
      ]);
      expect(await repo.closeChargers(id, [before.id])).toBe(1);
      await repo.addChargers(id, [after.id]);

      const staff = await repo.findById(id);
      expect(staff?.branchName).toBe("渋谷支店");
      expect(staff?.address?.address1).toBe("4-5-6");
      expect(staff?.regions.map((region) => region.regionCode)).toEqual([7]);
      expect(staff?.prefectures.map((prefecture) => prefecture.prefectureCode)).toEqual([91]);
      expect(staff?.familyMembers).toEqual([]);
      expect(staff?.memos.map((memo) => memo.content)).toEqual(["加入"]);
      expect(staff?.jobHistories).toHaveLength(1);
      expect(staff?.chargers.map((row) => [row.user.name, row.unassignedAt !== null])).toEqual([
        ["前任", true],
        ["後任", false],
      ]);
      expect(await repo.findCurrentChargerIds(id)).toEqual([after.id]);
    });
  });

  it("lists non-deleted staff with their regions and current 担当者, in the given order", async () => {
    await scenario(async (tx) => {
      const repo = createStaffRepository(tx);
      const marker = `マーカー${crypto.randomUUID().slice(0, 6)}`;
      const current = await createUser(tx, "現担当");
      const former = await createUser(tx, "元担当");
      const base = 10_000 + Math.floor(Math.random() * 1_000_000_000);
      const kept = await repo.create(
        write({ employeeNumber: base + 1, chargerUserIds: [current.id, former.id] }),
      );
      const first = await repo.create(write({ employeeNumber: base }));
      const gone = await repo.create(write({ employeeNumber: base + 2 }));
      await tx.staff.updateMany({
        where: { id: { in: [kept.id, first.id, gone.id] } },
        data: { branchName: marker },
      });
      await repo.closeChargers(kept.id, [former.id]);
      expect(await repo.softDeleteMany([gone.id])).toBe(1);

      const page = await repo.findMany({ page: 1, perPage: 10 }, { branchName: marker });

      expect(page.total).toBe(2);
      expect(page.items.map((staff) => staff.id)).toEqual([first.id, kept.id]);
      expect(page.items[1]?.chargers.map((row) => row.user.name)).toEqual(["現担当"]);
      expect(page.items[1]?.regions.map((region) => region.region.name)).toEqual(["南関東"]);
    });
  });

  it("counts the staff holding a スタッフ番号, leaving out deleted staff and one id", async () => {
    await scenario(async (tx) => {
      const repo = createStaffRepository(tx);
      const employeeNumber = 10_000 + Math.floor(Math.random() * 1_000_000_000);
      const { id } = await repo.create(write({ employeeNumber }));

      expect(await repo.countActiveByEmployeeNumber(employeeNumber)).toBe(1);
      expect(await repo.countActiveByEmployeeNumber(employeeNumber, id)).toBe(0);
      await repo.softDeleteMany([id]);
      expect(await repo.countActiveByEmployeeNumber(employeeNumber)).toBe(0);
      expect(await repo.findById(id)).toBeNull();
    });
  });

  it("changes the status and finds the staff a user is in charge of, within the caller's where", async () => {
    await scenario(async (tx) => {
      const repo = createStaffRepository(tx);
      const charger = await createUser(tx, "担当");
      const { id } = await repo.create(write({ chargerUserIds: [charger.id] }));

      expect(await repo.updateStatus(id, "SUSPENDED")).toEqual({ id, status: "SUSPENDED" });
      expect(await repo.findStatuses([id])).toEqual([{ id, status: "SUSPENDED" }]);
      expect(await repo.findStatuses([id], { status: "ACTIVE" })).toEqual([]);
      const charged = await repo.findManyByCharger(charger.id);
      expect(charged.map((staff) => staff.id)).toEqual([id]);
      expect(charged[0]?.regions).toEqual([{ regionCode: 4, region: { name: "南関東" } }]);
      expect(await repo.findManyByCharger(charger.id, { employeeType: "PART_TIME" })).toEqual([]);

      await repo.closeChargers(id, [charger.id]);
      expect(await repo.findManyByCharger(charger.id)).toEqual([]);
    });
  });
});
