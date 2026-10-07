import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchInput } from "../../../src/components/composed/search-input";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const box = () => screen.getByRole("searchbox", { name: "検索" });

const type = (text: string) => {
  fireEvent.change(box(), { target: { value: text } });
};

describe("SearchInput", () => {
  it("reports the trimmed text once typing pauses", () => {
    const onSearch = vi.fn();
    render(<SearchInput value="" onSearch={onSearch} label="検索" />);

    type("am");
    type(" amy ");
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("amy");
  });

  it("keeps what the user typed meanwhile when its own search comes back", () => {
    const onSearch = vi.fn();
    const { rerender } = render(<SearchInput value="" onSearch={onSearch} label="検索" />);

    type("am");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    type("amy");
    rerender(<SearchInput value="am" onSearch={onSearch} label="検索" />);

    expect(box()).toHaveProperty("value", "amy");
  });

  it("shows a value that changed elsewhere, such as the back button", () => {
    const onSearch = vi.fn();
    const { rerender } = render(<SearchInput value="amy" onSearch={onSearch} label="検索" />);

    rerender(<SearchInput value="bob" onSearch={onSearch} label="検索" />);
    expect(box()).toHaveProperty("value", "bob");

    rerender(<SearchInput value="" onSearch={onSearch} label="検索" />);
    expect(box()).toHaveProperty("value", "");
  });
});
