import { describe, expect, it } from "vitest";

import { branchFormSchema } from "@repo/validation";

import { BRANCH_STEP_FIELDS } from "@/features/branches/utils/branch-steps";

describe("branch steps", () => {
  it("check every field of the form exactly once before the confirm step", () => {
    const stepFields = BRANCH_STEP_FIELDS.flat();

    expect([...stepFields].sort()).toEqual(Object.keys(branchFormSchema.shape).sort());
    expect(new Set(stepFields).size).toBe(stepFields.length);
    expect(BRANCH_STEP_FIELDS.at(-1)).toEqual([]);
  });
});
