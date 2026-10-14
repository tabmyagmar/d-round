import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as staffService from "../../../src/modules/staff/staff.service";
import {
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
} from "../../support";
import type { TestHarness } from "../../support";

/** The audit rows of the staff service's writes (docs/adr/0015-audit-log.md). */
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

describe("staff writes in the audit log", () => {
  it("records a create, an edit, a status change and a delete, personal fields masked", async () => {
    const ctx = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
    const chargerId = (await signedInUser(h)).user.id;
    const created = await staffService.create(ctx, staffInput([chargerId]));
    const label = `${String(created.employeeNumber)} 山田 花子`;

    await staffService.update(ctx, {
      ...staffInput([chargerId], {
        employeeNumber: created.employeeNumber,
        branchName: "渋谷支店",
        phoneNumber: "080-9999-9999",
        memos: [{ memoType: "STAFF_MEMO", content: "再面談" }],
      }),
      staffId: created.id,
    });
    await staffService.changeStatus(ctx, { staffId: created.id, status: "SUSPENDED" });
    await staffService.removeMany(ctx, { staffIds: [created.id] });

    const rows = await rowsFor(created.id);
    expect(rows.map((row) => [row.action, row.entityType, row.entityLabel])).toEqual([
      ["staff.create", "Staff", label],
      ["staff.update", "Staff", label],
      ["staff.changeStatus", "Staff", label],
      ["staff.deleteMany", "Staff", label],
    ]);
    expect(rows[0]?.changes).toEqual(
      expect.arrayContaining([
        { field: "lastName", before: null, after: "山田" },
        { field: "birthday", masked: true },
        { field: "familyMembers", masked: true },
        { field: "memos", before: null, after: "スタッフメモ: 面談済み" },
      ]),
    );
    expect(rows[1]?.changes).toEqual([
      { field: "branchName", before: "新宿支店", after: "渋谷支店" },
      { field: "phoneNumber", masked: true },
      { field: "memos", before: "スタッフメモ: 面談済み", after: "スタッフメモ: 再面談" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/080-9999-9999|090-1234-5678|1990\/04\/01/);
    expect(rows[2]?.changes).toEqual([{ field: "status", before: "利用中", after: "停止" }]);
    expect(rows[3]?.changes).toEqual([]);
  });
});
