import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ConflictError } from "../../../src/core/errors";
import * as clientService from "../../../src/modules/client/client.service";
import {
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
} from "../../support";
import type { TestHarness } from "../../support";

/** The audit rows of the client service's writes (docs/adr/0015-audit-log.md). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

const rowsFor = (entityId: string) =>
  h.db.auditLog.findMany({
    where: { entityId, status: "SUCCESS" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

const adminCaller = async () => {
  const admin = await signedInUser(h, { role: "admin" });
  return { admin, ctx: await contextFor(h, admin.headers) };
};

describe("client writes in the audit log", () => {
  it("records a create, an edit, a status change and a delete with what each changed", async () => {
    const { admin, ctx } = await adminCaller();
    const charger = await signedInUser(h, { name: "担当 花子" });
    const created = await clientService.create(ctx, clientInput([charger.user.id]));
    const number = String(created.number);

    await clientService.update(ctx, {
      ...clientInput([charger.user.id], {
        number: created.number,
        name: "株式会社テスト改",
        fax: "03-0000-1111",
      }),
      clientId: created.id,
    });
    await clientService.changeStatus(ctx, { clientId: created.id, status: "SUSPENDED" });
    await clientService.removeMany(ctx, { clientIds: [created.id] });

    const rows = await rowsFor(created.id);
    expect(rows.map((row) => [row.action, row.entityLabel])).toEqual([
      ["client.create", `${number} 株式会社テスト`],
      ["client.update", `${number} 株式会社テスト改`],
      ["client.changeStatus", `${number} 株式会社テスト改`],
      ["client.deleteMany", `${number} 株式会社テスト改`],
    ]);
    expect(rows[0]).toMatchObject({ actorId: admin.user.id, entityType: "Client" });
    expect(rows[0]?.changes).toEqual(
      expect.arrayContaining([
        { field: "name", before: null, after: "株式会社テスト" },
        { field: "chargers", before: null, after: "担当 花子" },
        { field: "status", before: null, after: "利用中" },
      ]),
    );
    expect(rows[1]?.changes).toEqual([
      { field: "name", before: "株式会社テスト", after: "株式会社テスト改" },
      { field: "fax", before: null, after: "03-0000-1111" },
    ]);
    expect(rows[2]?.changes).toEqual([{ field: "status", before: "利用中", after: "停止" }]);
    expect(rows[3]?.changes).toEqual([]);
  });

  it("records a status set to the one it had, without fields", async () => {
    const { ctx } = await adminCaller();
    const client = await clientService.create(ctx, clientInput([(await signedInUser(h)).user.id]));

    await clientService.changeStatus(ctx, { clientId: client.id, status: "ACTIVE" });

    expect((await rowsFor(client.id)).map((row) => [row.action, row.changes])).toEqual([
      ["client.create", expect.any(Array)],
      ["client.changeStatus", []],
    ]);
  });

  it("records nothing of a delete the service refuses", async () => {
    const { ctx } = await adminCaller();
    const client = await clientService.create(ctx, clientInput([(await signedInUser(h)).user.id]));

    await expect(clientService.removeMany(ctx, { clientIds: [client.id] })).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect((await rowsFor(client.id)).map((row) => row.action)).toEqual(["client.create"]);
  });
});
