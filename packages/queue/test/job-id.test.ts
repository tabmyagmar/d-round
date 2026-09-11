import { describe, expect, it } from "vitest";

import { InvalidJobIdError, jobIdFor } from "../src/job-id";

describe("jobIdFor", () => {
  it("builds a deterministic id from prefix and entity id", () => {
    const uuid = "019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e";
    expect(jobIdFor("email", uuid)).toBe(`email-${uuid}`);
    expect(jobIdFor("email", uuid)).toBe(jobIdFor("email", uuid));
  });

  it("rejects characters BullMQ uses internally", () => {
    expect(() => jobIdFor("email", "a:b")).toThrow(InvalidJobIdError);
    expect(() => jobIdFor("email", "has space")).toThrow(InvalidJobIdError);
    expect(() => jobIdFor("em:ail", "abc")).toThrow(InvalidJobIdError);
    expect(() => jobIdFor("", "abc")).toThrow(InvalidJobIdError);
    expect(() => jobIdFor("email", "")).toThrow(InvalidJobIdError);
  });
});
