import { afterEach, describe, expect, it, vi } from "vitest";

import { dayjs, fromIsoDay, todayIsoDay, toIsoDay } from "../src";

afterEach(() => {
  vi.useRealTimers();
});

describe("calendar days", () => {
  it("reads a DATE column's midnight UTC as its own day and writes a day back the same way", () => {
    const stored = new Date("2026-04-01T00:00:00.000Z");

    expect(toIsoDay(stored)).toBe("2026-04-01");
    expect(fromIsoDay("2026-04-01")).toEqual(stored);
  });

  it("takes today in Japan: 23:30 UTC on 7 October is already 8 October there", () => {
    vi.useFakeTimers({ now: new Date("2026-10-07T23:30:00.000Z"), toFake: ["Date"] });

    expect(todayIsoDay()).toBe("2026-10-08");
  });

  it("formats in Japanese", () => {
    expect(dayjs("2026-10-08").format("M月D日(dd)")).toBe("10月8日(木)");
  });
});
