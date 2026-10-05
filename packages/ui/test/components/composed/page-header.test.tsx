import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "../../../src/components/composed/page-header";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the title as the page's level-1 heading", () => {
    render(<PageHeader title="担当者管理" />);
    expect(screen.getByRole("heading", { level: 1, name: "担当者管理" })).toBeDefined();
  });

  it("renders the description and the actions slot when given", () => {
    render(
      <PageHeader
        title="担当者管理"
        description="Manage who can sign in."
        actions={<button type="button">新規作成</button>}
      />,
    );
    expect(screen.getByText("Manage who can sign in.")).toBeDefined();
    expect(screen.getByRole("button", { name: "新規作成" })).toBeDefined();
  });

  it("renders only the title when description and actions are omitted", () => {
    const { container } = render(<PageHeader title="ホーム" />);
    expect(container.textContent).toBe("ホーム");
  });
});
