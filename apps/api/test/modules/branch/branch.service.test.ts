import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listBranchesSchema } from "@repo/validation";
import type { ListBranchesInput } from "@repo/validation";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../src/core/errors";
import * as branchService from "../../../src/modules/branch/branch.service";
import * as clientService from "../../../src/modules/client/client.service";
import {
  branchInput,
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

/** An admin's context, a 担当者 and a fresh client to put branches under. */
const adminWithClient = async (clientName = "株式会社テスト", clientKana = "テスト") => {
  const admin = await signedInUser(h, { role: "admin" });
  const charger = await signedInUser(h, { name: "担当 一郎" });
  const ctx = await contextFor(h, admin.headers);
  const client = await clientService.create(
    ctx,
    clientInput([charger.user.id], { name: clientName, nameKana: clientKana }),
  );
  return { ctx, chargerId: charger.user.id, clientId: client.id };
};

/** The query exactly as the router hands it to the service. */
const listQuery = (input: ListBranchesInput) => listBranchesSchema.parse(input);

describe("branch service: create and read", () => {
  it("creates a branch under a client with its address, region and 担当者", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();

    const branch = await branchService.create(
      ctx,
      branchInput(clientId, [chargerId], { memo: "鍵は受付" }),
    );

    expect(branch).toMatchObject({
      name: "新宿店",
      departmentName: "営業部",
      contactPosition: "LEADER",
      memo: "鍵は受付",
      status: "ACTIVE",
      client: { id: clientId, name: "株式会社テスト" },
      region: { name: "南関東" },
    });
    expect(branch.address).toMatchObject({
      address1: "1-2-3",
      sourceAddress: { pref: "東京都", city: "新宿区", town: "新宿" },
    });
    expect(branch.chargers.map((row) => row.user.name)).toEqual(["担当 一郎"]);
    expect((await branchService.getById(ctx, branch.id)).id).toBe(branch.id);
  });

  it("takes a 就業先番号 once per client, and frees it when the branch is deleted", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();
    const other = await adminWithClient();
    const first = await branchService.create(ctx, branchInput(clientId, [chargerId]));

    await expect(
      branchService.create(ctx, branchInput(clientId, [chargerId])),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      branchService.create(other.ctx, branchInput(other.clientId, [other.chargerId])),
    ).resolves.toBeDefined();
    await branchService.changeStatus(ctx, { branchId: first.id, status: "SUSPENDED" });
    await branchService.removeMany(ctx, { branchIds: [first.id] });
    await expect(
      branchService.create(ctx, branchInput(clientId, [chargerId])),
    ).resolves.toBeDefined();
  });

  it("refuses a region outside the エリア, an unknown post code, a deleted client and an inactive 担当者", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();
    const superAdmin = await signedInUser(h, { role: "super_admin" });
    const deleted = await adminWithClient();
    await clientService.changeStatus(deleted.ctx, {
      clientId: deleted.clientId,
      status: "SUSPENDED",
    });
    await clientService.removeMany(deleted.ctx, { clientIds: [deleted.clientId] });

    await expect(
      branchService.create(ctx, branchInput(clientId, [chargerId], { regionCode: 7 })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      branchService.create(
        ctx,
        branchInput(clientId, [chargerId], { address: { postCode: "0000000", address1: "x" } }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      branchService.create(ctx, branchInput(deleted.clientId, [chargerId])),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      branchService.create(ctx, branchInput(clientId, [superAdmin.user.id])),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("lets a manager read branches but not create them", async () => {
    const { clientId } = await adminWithClient();
    const manager = await signedInUser(h, { role: "manager" });
    const ctx = await contextFor(h, manager.headers);

    await expect(branchService.list(ctx, listQuery({}))).resolves.toBeDefined();
    await expect(
      branchService.create(ctx, branchInput(clientId, [manager.user.id])),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(branchService.nextNumber(ctx, { clientId })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("branch service: update", () => {
  it("moves a branch to another client and keeps the 担当者 still chosen", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();
    const target = await adminWithClient("株式会社移動先", "イドウサキ");
    const next = await signedInUser(h, { name: "追加 次郎" });
    const branch = await branchService.create(ctx, branchInput(clientId, [chargerId]));

    const updated = await branchService.update(ctx, {
      ...branchInput(target.clientId, [chargerId, next.user.id], {
        name: "渋谷店",
        area: "WEST",
        regionCode: 7,
        departmentFax: "03-1234-5679",
      }),
      branchId: branch.id,
    });

    expect(updated).toMatchObject({
      name: "渋谷店",
      client: { name: "株式会社移動先" },
      region: { name: "関西" },
      departmentFax: "03-1234-5679",
    });
    expect(updated.chargers.map((row) => row.user.name)).toEqual(["担当 一郎", "追加 次郎"]);
  });

  it("keeps a branch of a client deleted since editable, and a 担当者 deactivated since", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();
    const branch = await branchService.create(ctx, branchInput(clientId, [chargerId]));
    await clientService.changeStatus(ctx, { clientId, status: "SUSPENDED" });
    await clientService.removeMany(ctx, { clientIds: [clientId] });
    await h.db.user.update({ where: { id: chargerId }, data: { deletedAt: new Date() } });

    const updated = await branchService.update(ctx, {
      ...branchInput(clientId, [chargerId], { name: "新宿店改" }),
      branchId: branch.id,
    });

    expect(updated.name).toBe("新宿店改");
    expect(updated.chargers.map((row) => row.userId)).toEqual([chargerId]);
  });
});

describe("branch service: list", () => {
  it("filters by client, status, エリア and 地域, and searches the client and 担当者 names", async () => {
    const marker = `検索${String(uniqueEmployeeNumber())}`;
    const { ctx, chargerId, clientId } = await adminWithClient(marker, "ケンサク");
    const east = await branchService.create(ctx, branchInput(clientId, [chargerId]));
    const west = await branchService.create(
      ctx,
      branchInput(clientId, [chargerId], { number: 2, area: "WEST", regionCode: 7 }),
    );
    const suspended = await branchService.create(
      ctx,
      branchInput(clientId, [chargerId], { number: 3 }),
    );
    await branchService.changeStatus(ctx, { branchId: suspended.id, status: "SUSPENDED" });
    const ids = async (input: ListBranchesInput) =>
      (await branchService.list(ctx, listQuery(input))).items.map((branch) => branch.id).sort();

    expect(await ids({ search: marker })).toEqual([east.id, west.id].sort());
    expect(await ids({ clientId })).toEqual([east.id, west.id].sort());
    expect(await ids({ clientId, statuses: ["ACTIVE", "INACTIVE", "SUSPENDED"] })).toEqual(
      [east.id, west.id, suspended.id].sort(),
    );
    expect(await ids({ clientId, areas: ["WEST"] })).toEqual([west.id]);
    expect(await ids({ clientId, regionCodes: [4] })).toEqual([east.id]);
  });

  it("finds a branch by its 担当者 and sorts by the client's reading", async () => {
    const chargerName = `担当${String(uniqueEmployeeNumber())}`;
    const charger = await signedInUser(h, { name: chargerName });
    const later = await adminWithClient("株式会社後", "ンンン");
    const earlier = await adminWithClient("株式会社先", "アアア");
    const fromLater = await branchService.create(
      later.ctx,
      branchInput(later.clientId, [charger.user.id]),
    );
    const fromEarlier = await branchService.create(
      earlier.ctx,
      branchInput(earlier.clientId, [charger.user.id]),
    );

    const page = await branchService.list(
      later.ctx,
      listQuery({ search: chargerName, sortBy: "client", sortOrder: "asc" }),
    );

    expect(page.items.map((branch) => branch.id)).toEqual([fromEarlier.id, fromLater.id]);
  });
});

describe("branch service: status, delete, next number", () => {
  it("deletes only 停止 branches, all or nothing", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();
    const active = await branchService.create(ctx, branchInput(clientId, [chargerId]));
    const suspended = await branchService.create(
      ctx,
      branchInput(clientId, [chargerId], { number: 2 }),
    );
    await branchService.changeStatus(ctx, { branchId: suspended.id, status: "SUSPENDED" });

    await expect(
      branchService.removeMany(ctx, { branchIds: [active.id, suspended.id] }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await branchService.removeMany(ctx, { branchIds: [suspended.id] })).toEqual({
      count: 1,
    });
    expect((await branchService.getById(ctx, active.id)).status).toBe("ACTIVE");
  });

  it("offers the client's next 就業先番号, 1 for its first branch", async () => {
    const { ctx, chargerId, clientId } = await adminWithClient();

    expect(await branchService.nextNumber(ctx, { clientId })).toBe(1);
    await branchService.create(ctx, branchInput(clientId, [chargerId], { number: 7 }));
    expect(await branchService.nextNumber(ctx, { clientId })).toBe(8);
  });
});
