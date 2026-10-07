import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ForbiddenError } from "../../../src/core/errors";
import * as permissionService from "../../../src/modules/permission/permission.service";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

describe("catalog", () => {
  it("groups the visible catalog under its parents, in key order, with each child's roles", async () => {
    const admin = await signedInUser(h, { role: "admin" });

    const groups = await permissionService.catalog(await contextFor(h, admin.headers));

    const keys = groups.map((group) => group.key);
    expect(keys).toEqual([...keys].sort());
    const users = groups.find((group) => group.key === "1100");
    expect(users?.nameJp).toBe("マスタ管理");
    expect(users?.children.map((child) => child.key)).toEqual([
      "1101",
      "1102",
      "1103",
      "1104",
      "1105",
      "1106",
    ]);
    expect(users?.children.find((child) => child.key === "1102")).toMatchObject({
      nameJp: "担当者情報の一覧・詳細を確認",
      action: "read",
      modelName: "User",
      roles: ["admin", "super_admin"],
    });
    const clientRead = groups
      .find((group) => group.key === "1200")
      ?.children.find((child) => child.key === "1202");
    expect(clientRead?.roles).toEqual(["admin", "manager", "staff", "super_admin"]);
    expect(groups.every((group) => group.children.length > 0)).toBe(true);
  });

  it("refuses a caller who may not change roles", async () => {
    const manager = await signedInUser(h, { role: "manager" });

    await expect(
      permissionService.catalog(await contextFor(h, manager.headers)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
