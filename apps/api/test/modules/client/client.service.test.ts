import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listClientsSchema } from "@repo/validation";
import type { ListClientsInput } from "@repo/validation";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../src/core/errors";
import * as clientService from "../../../src/modules/client/client.service";
import {
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  uniqueEmployeeNumber,
} from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

/** An admin's context (every Admin_Client row) and a 担当者 to assign. */
const adminWithCharger = async () => {
  const admin = await signedInUser(h, { role: "admin" });
  const charger = await signedInUser(h, { name: "担当 一郎", profile: {} });
  return { ctx: await contextFor(h, admin.headers), chargerId: charger.user.id };
};

/** The query exactly as the router hands it to the service. */
const listQuery = (input: ListClientsInput) => listClientsSchema.parse(input);

describe("client service: create and read", () => {
  it("creates a client with its address, regions and 担当者", async () => {
    const { ctx, chargerId } = await adminWithCharger();

    const client = await clientService.create(
      ctx,
      clientInput([chargerId], {
        webUrl: "example.com",
        orderTypes: ["CONTRACT_WORK", "DISPATCH"],
      }),
    );

    expect(client).toMatchObject({
      name: "株式会社テスト",
      status: "ACTIVE",
      webUrl: "example.com",
      orderTypes: ["CONTRACT_WORK", "DISPATCH"],
    });
    expect(client.address).toMatchObject({
      address1: "1-2-3",
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    });
    expect(client.regions.map((region) => region.region.name)).toEqual(["南関東"]);
    expect(client.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
    expect((await clientService.getById(ctx, client.id)).id).toBe(client.id);
  });

  it("refuses a taken クライアント番号, unknown reference data and a 担当者 who is not an active user", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const taken = await clientService.create(ctx, clientInput([chargerId]));
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const gone = await signedInUser(h);
    await h.db.user.update({ where: { id: gone.user.id }, data: { deletedAt: new Date() } });

    await expect(
      clientService.create(ctx, clientInput([chargerId], { number: taken.number })),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      clientService.create(ctx, clientInput([chargerId], { regionCodes: [99] })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      clientService.create(
        ctx,
        clientInput([chargerId], { address: { postCode: "0000000", address1: "x" } }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      clientService.create(ctx, clientInput([superAdmin.user.id])),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(clientService.create(ctx, clientInput([gone.user.id]))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("frees the クライアント番号 of a deleted client", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const first = await clientService.create(ctx, clientInput([chargerId]));
    await clientService.changeStatus(ctx, { clientId: first.id, status: "SUSPENDED" });
    await clientService.removeMany(ctx, { clientIds: [first.id] });

    const again = await clientService.create(
      ctx,
      clientInput([chargerId], { number: first.number }),
    );

    expect(again.number).toBe(first.number);
    await expect(clientService.getById(ctx, first.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets a manager read clients but not create them", async () => {
    const manager = await signedInUser(h, { role: "manager" });
    const ctx = await contextFor(h, manager.headers);

    await expect(clientService.list(ctx, listQuery({}))).resolves.toBeDefined();
    await expect(clientService.create(ctx, clientInput([manager.user.id]))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("client service: update", () => {
  it("replaces the fields, address and regions, and keeps the 担当者 still chosen", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const next = await signedInUser(h, { name: "追加 次郎" });
    const client = await clientService.create(ctx, clientInput([chargerId]));

    const updated = await clientService.update(ctx, {
      ...clientInput([chargerId, next.user.id], {
        number: client.number,
        name: "株式会社変更",
        areas: ["WEST"],
        regionCodes: [7],
        address: { postCode: "1600022", address1: "4-5-6" },
        fax: "03-1234-5679",
      }),
      clientId: client.id,
    });

    expect(updated).toMatchObject({ name: "株式会社変更", areas: ["WEST"], fax: "03-1234-5679" });
    expect(updated.address?.address1).toBe("4-5-6");
    expect(updated.regions.map((region) => region.regionCode)).toEqual([7]);
    expect(updated.chargers.map((row) => row.user.name)).toEqual(["担当 一郎", "追加 次郎"]);
  });

  it("keeps a 担当者 deactivated since and checks only the 担当者 being added", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const client = await clientService.create(ctx, clientInput([chargerId]));
    await h.db.user.update({ where: { id: chargerId }, data: { deletedAt: new Date() } });

    const updated = await clientService.update(ctx, {
      ...clientInput([chargerId], { number: client.number, name: "株式会社継続" }),
      clientId: client.id,
    });

    expect(updated.name).toBe("株式会社継続");
    expect(updated.chargers.map((row) => row.userId)).toEqual([chargerId]);
    const gone = await signedInUser(h);
    await h.db.user.update({ where: { id: gone.user.id }, data: { deletedAt: new Date() } });
    await expect(
      clientService.update(ctx, {
        ...clientInput([chargerId, gone.user.id], { number: client.number }),
        clientId: client.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("client service: list", () => {
  it("filters, searches by クライアント番号, name and 担当者, and hides 停止 clients unless asked", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const marker = `検索${String(uniqueEmployeeNumber())}`;
    const east = await clientService.create(
      ctx,
      clientInput([chargerId], { name: marker, orderTypes: ["SPOT_WORK"] }),
    );
    const west = await clientService.create(
      ctx,
      clientInput([chargerId], { name: marker, areas: ["WEST"], regionCodes: [7] }),
    );
    const suspended = await clientService.create(ctx, clientInput([chargerId], { name: marker }));
    await clientService.changeStatus(ctx, { clientId: suspended.id, status: "SUSPENDED" });
    const ids = async (input: ListClientsInput) =>
      (await clientService.list(ctx, listQuery({ search: marker, ...input }))).items
        .map((client) => client.id)
        .sort();

    expect(await ids({})).toEqual([east.id, west.id].sort());
    expect(await ids({ statuses: ["SUSPENDED"] })).toEqual([suspended.id]);
    expect(await ids({ areas: ["WEST"] })).toEqual([west.id]);
    expect(await ids({ regionCodes: [4] })).toEqual([east.id]);
    expect(await ids({ orderTypes: ["SPOT_WORK"] })).toEqual([east.id]);
    const byNumber = await clientService.list(ctx, listQuery({ search: String(east.number) }));
    expect(byNumber.items.map((client) => client.id)).toEqual([east.id]);
    expect(byNumber.items[0]?.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
  });

  it("finds a client by its 担当者's name and sorts by the reading", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await contextFor(h, admin.headers);
    const chargerName = `担当${String(uniqueEmployeeNumber())}`;
    const charger = await signedInUser(h, { name: chargerName });
    const later = await clientService.create(
      ctx,
      clientInput([charger.user.id], { nameKana: "ンンン" }),
    );
    const earlier = await clientService.create(
      ctx,
      clientInput([charger.user.id], { nameKana: "アアア" }),
    );

    const page = await clientService.list(
      ctx,
      listQuery({ search: chargerName, sortBy: "name", sortOrder: "asc" }),
    );

    expect(page.items.map((client) => client.id)).toEqual([earlier.id, later.id]);
  });
});

describe("client service: status, delete, lookups", () => {
  it("deletes only 停止 clients, all or nothing", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const active = await clientService.create(ctx, clientInput([chargerId]));
    const suspended = await clientService.create(ctx, clientInput([chargerId]));
    await clientService.changeStatus(ctx, { clientId: suspended.id, status: "SUSPENDED" });

    await expect(
      clientService.removeMany(ctx, { clientIds: [active.id, suspended.id] }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await clientService.removeMany(ctx, { clientIds: [suspended.id] })).toEqual({
      count: 1,
    });
    expect((await clientService.getById(ctx, active.id)).status).toBe("ACTIVE");
  });

  it("tells whether a クライアント番号 is free, and refuses a caller who may not write clients", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const client = await clientService.create(ctx, clientInput([chargerId]));
    const am = await signedInUser(h);

    expect(await clientService.isNumberAvailable(ctx, { number: client.number })).toBe(false);
    expect(
      await clientService.isNumberAvailable(ctx, {
        number: client.number,
        excludeClientId: client.id,
      }),
    ).toBe(true);
    await expect(
      clientService.isNumberAvailable(await contextFor(h, am.headers), { number: client.number }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("offers non-deleted clients of any status matching the search, in kana order", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const marker = `候補${String(uniqueEmployeeNumber())}`;
    const later = await clientService.create(
      ctx,
      clientInput([chargerId], { name: marker, nameKana: "ンンン" }),
    );
    const earlier = await clientService.create(
      ctx,
      clientInput([chargerId], { name: marker, nameKana: "アアア" }),
    );
    const gone = await clientService.create(ctx, clientInput([chargerId], { name: marker }));
    await clientService.changeStatus(ctx, { clientId: later.id, status: "SUSPENDED" });
    await clientService.changeStatus(ctx, { clientId: gone.id, status: "SUSPENDED" });
    await clientService.removeMany(ctx, { clientIds: [gone.id] });

    expect(await clientService.options(ctx, { search: marker })).toEqual([
      { id: earlier.id, name: marker },
      { id: later.id, name: marker },
    ]);
    expect(await clientService.options(ctx, { search: String(earlier.number) })).toEqual([
      { id: earlier.id, name: marker },
    ]);
  });
});
