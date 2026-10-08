import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { seedSourceRegions } from "../../prisma/seed/source-regions.seed";
import { createPrismaClient } from "../../src/client";
import type { PrismaClient } from "../../src/client";
import { createClientRepository } from "../../src/repositories/client.repository";
import type { ClientWrite } from "../../src/repositories/client.repository";
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
 * container asserts exact counts, so the post code a client needs exists only inside it.
 */
const scenario = async (run: (tx: TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.sourceAddress.create({
        data: {
          jisCode: 13101,
          postCode: "0009992",
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

const uniqueNumber = () => 10_000 + Math.floor(Math.random() * 1_000_000_000);

const write = (overrides: Partial<ClientWrite> & { number?: number } = {}): ClientWrite => ({
  fields: {
    number: overrides.number ?? uniqueNumber(),
    name: "株式会社テスト",
    nameKana: "カブシキガイシャテスト",
    areas: ["EAST"],
    orderTypes: ["DISPATCH"],
    phoneNumber: "03-1234-5678",
    fax: null,
    webUrl: null,
  },
  address: { postCode: "0009992", address1: "1-2-3" },
  regionCodes: [4],
  chargerUserIds: [],
  ...overrides,
});

describe("client repository", () => {
  it("creates a client with its address, regions and 担当者, read back by name", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const charger = await createUser(tx, "担当 一郎");

      const { id } = await repo.create(
        write({ regionCodes: [4, 7], chargerUserIds: [charger.id] }),
      );
      const client = await repo.findById(id);

      expect(client).toMatchObject({
        name: "株式会社テスト",
        areas: ["EAST"],
        orderTypes: ["DISPATCH"],
        status: "ACTIVE",
      });
      expect(client?.address).toMatchObject({
        postCode: "0009992",
        address1: "1-2-3",
        sourceAddress: { pref: "東京都", city: "千代田区", town: "テスト" },
      });
      expect(client?.regions.map((region) => region.region.name)).toEqual(["南関東", "関西"]);
      expect(client?.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
    });
  });

  it("updates the fields and address, replaces the regions and keeps the 担当者 still chosen", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const kept = await createUser(tx, "継続");
      const removed = await createUser(tx, "解除");
      const added = await createUser(tx, "追加");
      const { id } = await repo.create(write({ chargerUserIds: [kept.id, removed.id] }));

      await repo.updateFields(
        id,
        { ...write().fields, name: "株式会社変更", fax: "03-9999-0000" },
        { postCode: "0009992", address1: "4-5-6" },
      );
      await repo.replaceRegions(id, [7]);
      await repo.replaceChargers(id, [kept.id, added.id]);

      const client = await repo.findById(id);
      expect(client).toMatchObject({ name: "株式会社変更", fax: "03-9999-0000" });
      expect(client?.address?.address1).toBe("4-5-6");
      expect(client?.regions.map((region) => region.regionCode)).toEqual([7]);
      expect(client?.chargers.map((row) => row.user.name)).toEqual(["継続", "追加"]);
      expect(new Set(await repo.findChargerIds(id))).toEqual(new Set([kept.id, added.id]));
    });
  });

  it("lists non-deleted clients with their address and 担当者, in the given order", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const marker = `マーカー${crypto.randomUUID().slice(0, 6)}`;
      const charger = await createUser(tx, "担当");
      const base = uniqueNumber();
      const second = await repo.create(write({ number: base + 1, chargerUserIds: [charger.id] }));
      const first = await repo.create(write({ number: base }));
      const gone = await repo.create(write({ number: base + 2 }));
      await tx.client.updateMany({
        where: { id: { in: [first.id, second.id, gone.id] } },
        data: { name: marker },
      });
      expect(await repo.softDeleteMany([gone.id])).toBe(1);

      const page = await repo.findMany({ page: 1, perPage: 10 }, { name: marker });

      expect(page.total).toBe(2);
      expect(page.items.map((client) => client.id)).toEqual([first.id, second.id]);
      expect(page.items[1]?.chargers.map((row) => row.user.name)).toEqual(["担当"]);
      expect(page.items[1]?.address?.sourceAddress.pref).toBe("東京都");
      const byNumberDesc = await repo.findMany({ page: 1, perPage: 10 }, { name: marker }, [
        { number: "desc" },
      ]);
      expect(byNumberDesc.items.map((client) => client.id)).toEqual([second.id, first.id]);
    });
  });

  it("counts the clients holding a クライアント番号, leaving out deleted clients and one id", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const number = uniqueNumber();
      const { id } = await repo.create(write({ number }));

      expect(await repo.countActiveByNumber(number)).toBe(1);
      expect(await repo.countActiveByNumber(number, id)).toBe(0);
      await repo.softDeleteMany([id]);
      expect(await repo.countActiveByNumber(number)).toBe(0);
      expect(await repo.findById(id)).toBeNull();
    });
  });

  it("changes the status and reads the statuses within the caller's where", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const { id } = await repo.create(write());

      expect(await repo.updateStatus(id, "SUSPENDED")).toEqual({ id, status: "SUSPENDED" });
      expect(await repo.findStatuses([id])).toEqual([{ id, status: "SUSPENDED" }]);
      expect(await repo.findStatuses([id], { status: "ACTIVE" })).toEqual([]);
    });
  });

  it("offers non-deleted clients within a where, in kana order, up to `take`", async () => {
    await scenario(async (tx) => {
      const repo = createClientRepository(tx);
      const marker = `マーカー${crypto.randomUUID().slice(0, 6)}`;
      const later = await repo.create(write());
      const earlier = await repo.create(write());
      const gone = await repo.create(write());
      await tx.client.update({ where: { id: later.id }, data: { name: marker, nameKana: "ン" } });
      await tx.client.update({ where: { id: earlier.id }, data: { name: marker, nameKana: "ア" } });
      await tx.client.update({ where: { id: gone.id }, data: { name: marker, nameKana: "イ" } });
      await repo.softDeleteMany([gone.id]);

      expect(await repo.findOptions({ name: marker }, 10)).toEqual([
        { id: earlier.id, name: marker },
        { id: later.id, name: marker },
      ]);
      expect(await repo.findOptions({ name: marker }, 1)).toEqual([
        { id: earlier.id, name: marker },
      ]);
    });
  });
});
