import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { UserProfileInput } from "@repo/validation";

import { ForbiddenError } from "../../../src/core/errors";
import * as userService from "../../../src/modules/user/user.service";
import { contextFor, createHarness, signedInUser, uniqueEmployeeNumber } from "../../support";
import type { TestHarness } from "../../support";

/** The audit rows of the user service's writes (docs/adr/0015-audit-log.md). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const profileInput = (overrides: Partial<UserProfileInput> = {}): UserProfileInput => ({
  employeeNumber: uniqueEmployeeNumber(),
  departmentName: "東日本営業部",
  position: "SV",
  retirementDate: null,
  areas: ["EAST"],
  regionCodes: [4],
  ...overrides,
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

describe("user writes in the audit log", () => {
  it("records an invitation with its filled fields, the email masked", async () => {
    const { admin, ctx } = await adminCaller();
    const profile = profileInput();

    const invited = await userService.invite(ctx, {
      email: `${crypto.randomUUID()}@example.com`,
      lastName: "監査",
      firstName: "花子",
      lastNameKana: "カンサ",
      firstNameKana: "ハナコ",
      role: "am",
      profile,
    });

    const [row] = await rowsFor(invited.id);
    expect(row).toMatchObject({
      action: "user.invite",
      actorId: admin.user.id,
      entityType: "User",
      entityLabel: `${String(profile.employeeNumber)} 監査 花子`,
    });
    expect(row?.changes).toEqual(
      expect.arrayContaining([
        { field: "lastName", before: null, after: "監査" },
        { field: "departmentName", before: null, after: "東日本営業部" },
        { field: "email", masked: true },
        { field: "role", before: null, after: "AM" },
      ]),
    );
    expect(JSON.stringify(row?.changes)).not.toContain(invited.email);
  });

  it("records only what an edit changed, the role and the overrides by name", async () => {
    const { ctx } = await adminCaller();
    const target = await signedInUser(h, { name: "編集 太郎", profile: {} });

    await userService.update(ctx, { userId: target.user.id, lastName: "変更", role: "manager" });
    await userService.update(ctx, { userId: target.user.id, permissionKeys: ["1301"] });

    const [renamed, overridden] = await rowsFor(target.user.id);
    expect(renamed?.changes).toEqual([
      { field: "lastName", before: null, after: "変更" },
      { field: "role", before: "AM", after: "マネジャー" },
    ]);
    // Ticking only 1301 adds it to the manager's grants and removes the role's others.
    expect(overridden?.changes).toEqual([
      {
        field: "permissions",
        before: null,
        after: expect.stringContaining("＋スタッフ新規登録,－スタッフ情報の一覧・詳細を確認"),
      },
    ]);
  });

  it("records a profile saved without a change, and a renaming", async () => {
    const user = await signedInUser(h, { name: "自分 一郎", profile: {} });
    const ctx = await contextFor(h, user.headers);

    await userService.updateProfile(ctx, {});
    await userService.updateProfile(ctx, { firstName: "二郎" });

    const rows = await rowsFor(user.user.id);
    expect(rows.map((row) => [row.action, row.actorId, row.changes])).toEqual([
      ["user.updateProfile", user.user.id, []],
      ["user.updateProfile", user.user.id, [{ field: "firstName", before: null, after: "二郎" }]],
    ]);
  });

  it("records a deactivation and a reactivation as changes of the status", async () => {
    const { ctx } = await adminCaller();
    const target = await signedInUser(h, { profile: {} });

    await userService.deactivate(ctx, target.user.id);
    await userService.reactivate(ctx, target.user.id);

    expect((await rowsFor(target.user.id)).map((row) => [row.action, row.changes])).toEqual([
      ["user.deactivate", [{ field: "status", before: "利用中", after: "停止" }]],
      ["user.reactivate", [{ field: "status", before: "停止", after: "利用中" }]],
    ]);
  });

  it("records a re-sent password link without fields", async () => {
    const { admin, ctx } = await adminCaller();
    const target = await signedInUser(h);

    await userService.sendPasswordReset(ctx, target.user.id);

    expect(await rowsFor(target.user.id)).toEqual([
      expect.objectContaining({
        action: "user.sendPasswordReset",
        actorId: admin.user.id,
        changes: [],
      }),
    ]);
  });

  it("records nothing for a write the service refuses", async () => {
    const am = await signedInUser(h);
    const other = await signedInUser(h);

    await expect(
      userService.update(await contextFor(h, am.headers), {
        userId: other.user.id,
        lastName: "改ざん",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(await rowsFor(other.user.id)).toEqual([]);
  });
});
