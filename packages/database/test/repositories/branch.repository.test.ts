import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createBranchRepository } from "../../src/repositories/branch.repository";
import type { BranchWrite } from "../../src/repositories/branch.repository";
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
 * Runs a scenario inside a transaction that always rolls back: the address seed test on the same
 * container asserts exact counts, so the post code a branch needs exists only inside it.
 */
const scenario = async (run: (tx: TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.sourceAddress.create({
        data: {
          jisCode: 13101,
          postCode: "0009993",
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

const uniqueNumber = () => 10_000 + Math.floor(Math.random() * 1_000_000_000);

const createClient = (tx: TransactionClient, nameKana = "テスト") =>
  tx.client.create({
    data: {
      number: uniqueNumber(),
      name: "株式会社テスト",
      nameKana,
      areas: ["EAST"],
      orderTypes: [],
      phoneNumber: "03-1234-5678",
    },
  });

const createUser = (tx: TransactionClient, name: string) =>
  tx.user.create({ data: { name, email: `${crypto.randomUUID()}@example.com` } });

const write = (clientId: string, overrides: Partial<BranchWrite["fields"]> = {}): BranchWrite => ({
  fields: {
    clientId,
    number: 1,
    name: "新宿店",
    nameKana: "シンジュクテン",
    area: "EAST",
    regionCode: 4,
    departmentNumber: 10,
    departmentName: "営業部",
    departmentNameKana: "エイギョウブ",
    departmentFax: null,
    contactLastName: "山田",
    contactFirstName: "太郎",
    contactLastNameKana: "ヤマダ",
    contactFirstNameKana: "タロウ",
    contactPosition: "LEADER",
    contactEmail: "yamada@example.com",
    memo: null,
    ...overrides,
  },
  address: { postCode: "0009993", address1: "1-2-3" },
  chargerUserIds: [],
});

describe("branch repository", () => {
  it("creates a branch with its address and 担当者, read back with its client and region", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const client = await createClient(tx);
      const charger = await createUser(tx, "担当 一郎");

      const { id } = await repo.create({ ...write(client.id), chargerUserIds: [charger.id] });
      const branch = await repo.findById(id);

      expect(branch).toMatchObject({
        name: "新宿店",
        area: "EAST",
        departmentName: "営業部",
        contactPosition: "LEADER",
        status: "ACTIVE",
        client: { id: client.id, number: client.number, name: "株式会社テスト" },
        region: { name: "南関東" },
      });
      expect(branch?.address).toMatchObject({
        address1: "1-2-3",
        sourceAddress: { pref: "東京都", city: "千代田区", town: "テスト" },
      });
      expect(branch?.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
    });
  });

  it("updates the fields and address, moves it to another client, keeps the 担当者 still chosen", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const first = await createClient(tx);
      const second = await createClient(tx);
      const kept = await createUser(tx, "継続");
      const removed = await createUser(tx, "解除");
      const added = await createUser(tx, "追加");
      const { id } = await repo.create({
        ...write(first.id),
        chargerUserIds: [kept.id, removed.id],
      });

      await repo.updateFields(
        id,
        write(second.id, { name: "渋谷店", regionCode: 7, area: "WEST", memo: "メモ" }).fields,
        { postCode: "0009993", address1: "4-5-6" },
      );
      await repo.replaceChargers(id, [kept.id, added.id]);

      const branch = await repo.findById(id);
      expect(branch).toMatchObject({
        name: "渋谷店",
        memo: "メモ",
        client: { id: second.id },
        region: { name: "関西" },
      });
      expect(branch?.address?.address1).toBe("4-5-6");
      expect(branch?.chargers.map((row) => row.user.name)).toEqual(["継続", "追加"]);
    });
  });

  it("lists non-deleted branches in the given order, the client's reading among them", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const later = await createClient(tx, "ンンン");
      const earlier = await createClient(tx, "アアア");
      const marker = `マーカー${crypto.randomUUID().slice(0, 6)}`;
      const first = await repo.create(write(later.id, { name: marker, number: 1 }));
      const second = await repo.create(write(earlier.id, { name: marker, number: 2 }));
      const gone = await repo.create(write(earlier.id, { name: marker, number: 3 }));
      expect(await repo.softDeleteMany([gone.id])).toBe(1);

      const byNumber = await repo.findMany({ page: 1, perPage: 10 }, { name: marker });
      const byClient = await repo.findMany({ page: 1, perPage: 10 }, { name: marker }, [
        { client: { nameKana: "asc" } },
      ]);

      expect(byNumber.total).toBe(2);
      expect(byNumber.items.map((branch) => branch.id)).toEqual([first.id, second.id]);
      expect(byClient.items.map((branch) => branch.id)).toEqual([second.id, first.id]);
    });
  });

  it("counts a 就業先番号 within its client only, leaving out deleted branches and one id", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const client = await createClient(tx);
      const other = await createClient(tx);
      const { id } = await repo.create(write(client.id, { number: 5 }));
      await repo.create(write(other.id, { number: 5 }));

      expect(await repo.countActiveByNumber(client.id, 5)).toBe(1);
      expect(await repo.countActiveByNumber(client.id, 5, id)).toBe(0);
      expect(await repo.countActiveByNumber(client.id, 6)).toBe(0);
      await repo.softDeleteMany([id]);
      expect(await repo.countActiveByNumber(client.id, 5)).toBe(0);
      expect(await repo.findById(id)).toBeNull();
    });
  });

  it("finds the highest 就業先番号 of a client's non-deleted branches", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const client = await createClient(tx);

      expect(await repo.maxNumber(client.id)).toBeNull();
      await repo.create(write(client.id, { number: 3 }));
      const top = await repo.create(write(client.id, { number: 9 }));
      expect(await repo.maxNumber(client.id)).toBe(9);
      await repo.softDeleteMany([top.id]);
      expect(await repo.maxNumber(client.id)).toBe(3);
    });
  });

  it("changes the status and reads the statuses within the caller's where", async () => {
    await scenario(async (tx) => {
      const repo = createBranchRepository(tx);
      const client = await createClient(tx);
      const { id } = await repo.create(write(client.id));

      expect(await repo.updateStatus(id, "SUSPENDED")).toEqual({ id, status: "SUSPENDED" });
      expect(await repo.findStatuses([id])).toEqual([{ id, status: "SUSPENDED" }]);
      expect(await repo.findStatuses([id], { status: "ACTIVE" })).toEqual([]);
    });
  });
});
