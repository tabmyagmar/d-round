import { describe, expect, it } from "vitest";

import { branchSaveErrorOf } from "@/features/branches/utils/branch-labels";

describe("branch labels", () => {
  it("says a 就業先番号 the client already uses the legacy way, anything else as the API did", () => {
    expect(branchSaveErrorOf({ message: "x", data: { code: "CONFLICT" } })).toBe(
      "入力された就業先番号はすでに登録済みです。内容を再度ご確認ください",
    );
    expect(branchSaveErrorOf({ message: "Unknown region 99", data: { code: "BAD_REQUEST" } })).toBe(
      "Unknown region 99",
    );
  });
});
