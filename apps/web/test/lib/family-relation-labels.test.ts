import { describe, expect, it } from "vitest";

import { FAMILY_RELATIONS } from "@repo/validation";

import { FAMILY_RELATION_LABELS, FAMILY_RELATION_OPTIONS } from "@/lib/family-relation-labels";

describe("family relation labels", () => {
  it("names every relation with the legacy Japanese labels, in the legacy order", () => {
    expect(FAMILY_RELATIONS.map((relation) => FAMILY_RELATION_LABELS[relation])).toEqual([
      "夫",
      "妻",
      "父",
      "母",
      "義父",
      "義母",
      "祖父",
      "祖母",
      "長男",
      "次男",
      "三男",
      "長女",
      "次女",
      "三女",
      "孫",
      "甥",
      "姪",
      "伯父",
      "伯母",
      "叔父",
      "叔母",
      "曽祖父",
      "曽祖母",
    ]);
    expect(FAMILY_RELATION_OPTIONS.map((option) => option.value)).toEqual([...FAMILY_RELATIONS]);
  });
});
