import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as branchService from "../../../src/modules/branch/branch.service";
import * as clientService from "../../../src/modules/client/client.service";
import {
  branchInput,
  clientInput,
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
} from "../../support";
import type { TestHarness } from "../../support";

/** The audit rows of the branch service's writes (docs/adr/0015-audit-log.md). */
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

describe("branch writes in the audit log", () => {
  it("records a create, an edit, a status change and a delete, the contact's email masked", async () => {
    const ctx = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
    const charger = await signedInUser(h);
    const client = await clientService.create(ctx, clientInput([charger.user.id]));
    const created = await branchService.create(ctx, branchInput(client.id, [charger.user.id]));
    const label = `${String(client.number)}-1 新宿店`;

    await branchService.update(ctx, {
      ...branchInput(client.id, [charger.user.id], {
        departmentName: "総務部",
        contactEmail: "kanri@example.com",
        memo: "鍵は守衛室",
      }),
      branchId: created.id,
    });
    await branchService.changeStatus(ctx, { branchId: created.id, status: "SUSPENDED" });
    await branchService.removeMany(ctx, { branchIds: [created.id] });

    const rows = await rowsFor(created.id);
    expect(rows.map((row) => [row.action, row.entityType, row.entityLabel])).toEqual([
      ["branch.create", "Branch", label],
      ["branch.update", "Branch", label],
      ["branch.changeStatus", "Branch", label],
      ["branch.deleteMany", "Branch", label],
    ]);
    expect(rows[0]?.changes).toEqual(
      expect.arrayContaining([
        { field: "departmentName", before: null, after: "営業部" },
        { field: "contactEmail", masked: true },
      ]),
    );
    expect(rows[1]?.changes).toEqual([
      { field: "departmentName", before: "営業部", after: "総務部" },
      { field: "contactEmail", masked: true },
      { field: "memo", before: null, after: "鍵は守衛室" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/yamada@example\.com|kanri@example\.com/);
    expect(rows[2]?.changes).toEqual([{ field: "status", before: "利用中", after: "停止" }]);
    expect(rows[3]?.changes).toEqual([]);
  });
});
