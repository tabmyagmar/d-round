import { describe, expect, it } from "vitest";

import { GENERAL_STATUSES } from "@repo/validation";

import { GENERAL_STATUS_LABELS, GENERAL_STATUS_OPTIONS } from "@/lib/general-status-labels";

describe("general status labels", () => {
  it("names the three statuses with the legacy Japanese labels, in the legacy order", () => {
    expect(GENERAL_STATUSES.map((status) => GENERAL_STATUS_LABELS[status])).toEqual([
      "利用中",
      "保留",
      "停止",
    ]);
    expect(GENERAL_STATUS_OPTIONS.map((option) => option.value)).toEqual([...GENERAL_STATUSES]);
  });
});
