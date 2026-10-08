import { describe, expect, it } from "vitest";

import {
  branchValuesOf,
  emptyBranchValues,
  toBranchInput,
} from "@/features/branches/utils/branch-form-input";
import { branchSaveErrorOf } from "@/features/branches/utils/branch-labels";

import { branchRow } from "../fixtures";

describe("branch form input", () => {
  it("starts a new branch empty, without a client, FAX or memo", () => {
    expect(emptyBranchValues()).toMatchObject({
      clientId: "",
      chargerUserIds: [],
      departmentFax: null,
      address: { postCode: "", address1: "", pref: "", cityTown: "" },
      memo: null,
    });
  });

  it("edits the stored branch: its client and region, the post code with its hyphen, the 担当者", () => {
    expect(branchValuesOf(branchRow({ memo: "鍵は受付" }))).toMatchObject({
      clientId: "client-1",
      number: 3,
      area: "EAST",
      regionCode: 4,
      chargerUserIds: ["charger-1"],
      departmentNumber: 10,
      address: { postCode: "160-0022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
      contactPosition: "LEADER",
      memo: "鍵は受付",
    });
  });

  it("sends the address without the parts the lookup filled", () => {
    const values = branchValuesOf(branchRow());
    const input = toBranchInput({
      ...(values as Parameters<typeof toBranchInput>[0]),
      address: { postCode: "1600022", address1: "1-2-3", pref: "東京都", cityTown: "新宿区新宿" },
    });

    expect(input.address).toEqual({ postCode: "1600022", address1: "1-2-3" });
  });

  it("says a 就業先番号 the client already uses the legacy way, anything else as the API did", () => {
    expect(branchSaveErrorOf({ message: "x", data: { code: "CONFLICT" } })).toBe(
      "入力された就業先番号はすでに登録済みです。内容を再度ご確認ください",
    );
    expect(branchSaveErrorOf({ message: "Unknown region 99", data: { code: "BAD_REQUEST" } })).toBe(
      "Unknown region 99",
    );
  });
});
