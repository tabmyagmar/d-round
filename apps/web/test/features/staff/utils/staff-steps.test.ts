import { describe, expect, it } from "vitest";

import { staffFormSchema } from "@repo/validation";

import { STAFF_STEP_FIELDS, stepOfErrors } from "@/features/staff/utils/staff-steps";

describe("staff steps", () => {
  it("check every field of the form exactly once before the confirm step", () => {
    const stepFields = STAFF_STEP_FIELDS.flat();

    expect([...stepFields].sort()).toEqual(Object.keys(staffFormSchema.shape).sort());
    expect(new Set(stepFields).size).toBe(stepFields.length);
  });

  it("finds the first step holding an error", () => {
    expect(stepOfErrors(["memos"])).toBe(1);
    expect(stepOfErrors(["memos", "address"])).toBe(0);
    expect(stepOfErrors([])).toBe(0);
  });
});
