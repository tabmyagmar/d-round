import { describe, expect, it } from "vitest";

import { chargerNamesOf } from "@/lib/charger-labels";

describe("charger labels", () => {
  it("joins the 担当者 by name, and names nothing without them", () => {
    expect(chargerNamesOf([{ user: { name: "佐藤 一郎" } }, { user: { name: "鈴木 花子" } }])).toBe(
      "佐藤 一郎、鈴木 花子",
    );
    expect(chargerNamesOf([])).toBeNull();
  });
});
