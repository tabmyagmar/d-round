import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "../../../src/components/composed/empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title as a heading, the description and the action", () => {
    render(
      <EmptyState
        title="準備中"
        description="この画面は現在開発中です"
        action={<a href="/admin">ホームへ戻る</a>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "準備中" })).toBeDefined();
    expect(screen.getByText("この画面は現在開発中です")).toBeDefined();
    expect(screen.getByRole("link", { name: "ホームへ戻る" }).getAttribute("href")).toBe("/admin");
  });

  it("renders the icon slot when given", () => {
    render(<EmptyState title="準備中" icon={<svg data-testid="empty-icon" />} />);
    expect(screen.getByTestId("empty-icon")).toBeDefined();
  });

  it("renders only the title when the optional slots are omitted", () => {
    const { container } = render(<EmptyState title="Not found" />);
    expect(container.textContent).toBe("Not found");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
