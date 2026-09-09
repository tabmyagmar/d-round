import { describe, expect, it } from "vitest";

import { DEFAULT_JOB_OPTIONS } from "./queue";

describe("DEFAULT_JOB_OPTIONS", () => {
  it("retries 5 times with exponential backoff starting at 3s", () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(5);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({ type: "exponential", delay: 3000 });
  });

  it("keeps completed jobs 24h (max 1000) and failed jobs 7 days", () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({ age: 86_400, count: 1000 });
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({ age: 604_800 });
  });
});
