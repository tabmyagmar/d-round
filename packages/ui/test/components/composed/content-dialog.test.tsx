import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContentDialog } from "../../../src/components/composed/content-dialog";

afterEach(cleanup);

describe("ContentDialog", () => {
  it("shows the title, description, body and footer while open", () => {
    render(
      <ContentDialog
        open
        onOpenChange={vi.fn()}
        title="Permissions"
        description="Adjust them for this user."
        footer={<button type="button">Save</button>}
      >
        <p>Body</p>
      </ContentDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Permissions" })).toBeDefined();
    expect(screen.getByText("Adjust them for this user.")).toBeDefined();
    expect(screen.getByText("Body")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("does not render its body while closed", () => {
    const body = vi.fn(() => <p>Body</p>);
    const Body = body;
    render(
      <ContentDialog open={false} onOpenChange={vi.fn()} title="Permissions">
        <Body />
      </ContentDialog>,
    );

    expect(body).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks to close from its close button", () => {
    const onOpenChange = vi.fn();
    render(
      <ContentDialog open onOpenChange={onOpenChange} title="Permissions">
        <p>Body</p>
      </ContentDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
