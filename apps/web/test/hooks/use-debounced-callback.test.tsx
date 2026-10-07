// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDebouncedCallback", () => {
  it("calls once, with the last arguments, after the calls stop for the delay", () => {
    const calls: string[] = [];
    const { result } = renderHook(() =>
      useDebouncedCallback((value: string) => calls.push(value), 300),
    );

    result.current("a");
    vi.advanceTimersByTime(200);
    result.current("ab");
    vi.advanceTimersByTime(299);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["ab"]);
  });

  it("uses the callback of the latest render", () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(
      ({ prefix }: { prefix: string }) =>
        useDebouncedCallback((value: string) => calls.push(`${prefix}${value}`), 300),
      { initialProps: { prefix: "old:" } },
    );

    result.current("x");
    rerender({ prefix: "new:" });
    vi.advanceTimersByTime(300);

    expect(calls).toEqual(["new:x"]);
  });

  it("drops a pending call when the component unmounts", () => {
    const calls: string[] = [];
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback((value: string) => calls.push(value), 300),
    );

    result.current("late");
    unmount();
    vi.advanceTimersByTime(300);

    expect(calls).toEqual([]);
  });
});
