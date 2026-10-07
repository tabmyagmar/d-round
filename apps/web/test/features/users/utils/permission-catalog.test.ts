import { describe, expect, it } from "vitest";

import {
  grantedGroups,
  roleKeysOf,
  toCheckboxGroups,
} from "@/features/users/utils/permission-catalog";

import { CATALOG } from "../catalog-fixture";

describe("roleKeysOf", () => {
  it("lists the child keys a role holds, in catalog order", () => {
    expect(roleKeysOf(CATALOG, "manager")).toEqual(["1202"]);
    expect(roleKeysOf(CATALOG, "admin")).toEqual(["1101", "1102", "1202", "1203"]);
  });
});

describe("grantedGroups", () => {
  it("keeps the granted children under their group and drops groups with none", () => {
    const groups = grantedGroups(CATALOG, ["1101", "1203"]);

    expect(groups.map((group) => [group.nameJp, group.children.map((child) => child.key)])).toEqual(
      [
        ["マスタ管理", ["1101"]],
        ["クライアント管理", ["1203"]],
      ],
    );
    expect(grantedGroups(CATALOG, ["1203"]).map((group) => group.key)).toEqual(["1200"]);
  });
});

describe("toCheckboxGroups", () => {
  it("turns the catalog into checkbox groups and marks the role's permissions 標準", () => {
    const groups = toCheckboxGroups(CATALOG, ["1202"]);

    expect(groups.map((group) => group.label)).toEqual(["マスタ管理", "クライアント管理"]);
    expect(groups[1]?.options).toEqual([
      { value: "1202", label: "クライアント情報の一覧・詳細を確認", hint: "標準" },
      { value: "1203", label: "クライアント情報編集" },
    ]);
  });
});
