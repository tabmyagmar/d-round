import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterTags } from "../../../src/components/composed/filter-tags";

afterEach(cleanup);

const TAGS = [
  { key: "role", label: "Role", value: "Admin" },
  { key: "status", label: "Status", value: "Deactivated" },
];

describe("FilterTags", () => {
  it("shows each active filter as label and value", () => {
    render(<FilterTags tags={TAGS} onRemove={vi.fn()} onClearAll={vi.fn()} />);

    expect(screen.getByText("Admin")).toBeDefined();
    expect(screen.getByText("Deactivated")).toBeDefined();
  });

  it("removes one filter or all of them", () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(<FilterTags tags={TAGS} onRemove={onRemove} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Role" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onRemove).toHaveBeenCalledWith("role");
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without active filters", () => {
    const { container } = render(<FilterTags tags={[]} onRemove={vi.fn()} onClearAll={vi.fn()} />);

    expect(container.childElementCount).toBe(0);
  });
});
