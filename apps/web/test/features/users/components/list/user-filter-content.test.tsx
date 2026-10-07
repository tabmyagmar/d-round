// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserFilterContent } from "@/features/users/components/list/user-filter-content";

afterEach(cleanup);

/** Base UI selects an option on pointer up, as a real pointer would. */
const choose = (option: HTMLElement) => {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
};

describe("UserFilterContent", () => {
  it("shows the account type and status in effect", () => {
    render(
      <UserFilterContent
        filters={{ search: "", role: "manager", status: "deactivated" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("アカウントタイプ").textContent).toContain("マネジャー");
    expect(screen.getByLabelText("ステータス").textContent).toContain("停止");
  });

  it("clears the account type with すべて and keeps the default status out of the URL", async () => {
    const onChange = vi.fn();
    render(
      <UserFilterContent
        filters={{ search: "", role: "manager", status: "deactivated" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("アカウントタイプ"));
    choose(await screen.findByRole("option", { name: "すべて" }));
    fireEvent.click(screen.getByLabelText("ステータス"));
    choose(await screen.findByRole("option", { name: "利用中" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { role: null });
    expect(onChange).toHaveBeenNthCalledWith(2, { status: null });
  });
});
