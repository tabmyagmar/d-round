// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserFilterContent } from "@/features/users/components/list/user-filter-content";
import type { UserListFilters } from "@/features/users/utils/user-filters";

import { HIERARCHY } from "../../../../components/source/hierarchy-fixture";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

const FILTERS: UserListFilters = {
  search: "",
  role: "manager",
  status: "deactivated",
  areas: [],
  regionCodes: [7],
  positions: ["SV"],
};

const renderContent = (onChange = vi.fn()) => {
  render(<UserFilterContent filters={FILTERS} hierarchy={HIERARCHY} onChange={onChange} />);
  return onChange;
};

describe("UserFilterContent", () => {
  it("shows the filters in effect in the legacy order", () => {
    renderContent();

    expect(screen.getByLabelText("ステータス").textContent).toContain("停止");
    expect(screen.getByLabelText("アカウントタイプ").textContent).toContain("マネジャー");
    expect(screen.getByText("関西")).toBeDefined();
    expect(screen.getByText("AM")).toBeDefined();
    const labels = ["ステータス", "エリア", "地域", "役職", "アカウントタイプ"].map((label) =>
      screen.getByText(label, { selector: "label, legend" }),
    );
    for (const [index, label] of labels.slice(1).entries()) {
      // DOCUMENT_POSITION_FOLLOWING: each label comes after the previous one.
      expect(labels[index]!.compareDocumentPosition(label) & 4).toBe(4);
    }
  });

  it("clears the account type with すべて and keeps the default status out of the URL", async () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByLabelText("アカウントタイプ"));
    choose(await screen.findByRole("option", { name: "すべて" }));
    fireEvent.click(screen.getByLabelText("ステータス"));
    choose(await screen.findByRole("option", { name: "利用中" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { role: null });
    expect(onChange).toHaveBeenNthCalledWith(2, { status: null });
  });

  it("writes エリア and drops the regions it does not cover", () => {
    const onChange = renderContent();

    fireEvent.click(screen.getByRole("checkbox", { name: "東日本" }));

    expect(onChange).toHaveBeenLastCalledWith({ areas: ["EAST"], regionCodes: [] });
  });

  it("writes the chosen positions", async () => {
    const onChange = renderContent();

    const input = screen.getByLabelText("役職");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    choose(await screen.findByRole("option", { name: "リーダー" }));

    expect(onChange).toHaveBeenLastCalledWith({ positions: ["SV", "LEADER"] });
  });
});
