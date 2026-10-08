import { describe, expect, it } from "vitest";

import { clientFormSchema } from "@repo/validation";

import { CLIENT_STEP_FIELDS } from "@/features/clients/utils/client-steps";

describe("client steps", () => {
  it("check every field of the form exactly once before the confirm step", () => {
    const stepFields = CLIENT_STEP_FIELDS.flat();

    expect([...stepFields].sort()).toEqual(Object.keys(clientFormSchema.shape).sort());
    expect(new Set(stepFields).size).toBe(stepFields.length);
    expect(CLIENT_STEP_FIELDS.at(-1)).toEqual([]);
  });
});
