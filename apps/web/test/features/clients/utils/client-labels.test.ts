import { describe, expect, it } from "vitest";

import { CLIENT_ORDER_TYPES } from "@repo/validation";

import {
  CLIENT_ORDER_TYPE_LABELS,
  CLIENT_ORDER_TYPE_OPTIONS,
  clientSaveErrorOf,
  orderTypeNamesOf,
} from "@/features/clients/utils/client-labels";

describe("client labels", () => {
  it("names every 受注区分 with the legacy Japanese labels, in the legacy order", () => {
    expect(CLIENT_ORDER_TYPES.map((type) => CLIENT_ORDER_TYPE_LABELS[type])).toEqual([
      "業務請負",
      "派遣",
      "スポット",
    ]);
    expect(CLIENT_ORDER_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      ...CLIENT_ORDER_TYPES,
    ]);
  });

  it("joins the 受注区分 by name, and names nothing without them", () => {
    expect(orderTypeNamesOf(["CONTRACT_WORK", "SPOT_WORK"])).toBe("業務請負、スポット");
    expect(orderTypeNamesOf([])).toBeNull();
  });

  it("says a number taken while the form was open the legacy way, anything else as the API did", () => {
    expect(clientSaveErrorOf({ message: "x", data: { code: "CONFLICT" } })).toBe(
      "クライアント番号が既に登録されています",
    );
    expect(clientSaveErrorOf({ message: "Unknown region 99", data: { code: "BAD_REQUEST" } })).toBe(
      "Unknown region 99",
    );
  });
});
