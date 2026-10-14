import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResponsiveDialog } from "../../../src/components/composed/responsive-dialog";

// jsdom has no matchMedia; useIsMobile subscribes to one and reads the width from innerWidth.
const stubViewport = (width: number) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderDialog = () => {
  render(
    <ResponsiveDialog
      open
      onOpenChange={vi.fn()}
      title="CSVから担当者を追加"
      description="The steps"
      footer={<button type="button">Close</button>}
    >
      <p>Body</p>
    </ResponsiveDialog>,
  );
  return screen.getByRole("dialog", { name: "CSVから担当者を追加" });
};

describe("ResponsiveDialog", () => {
  it("is a dialog from md up", () => {
    stubViewport(1024);

    const dialog = renderDialog();

    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");
    expect(dialog.textContent).toContain("Body");
  });

  it("is a drawer from the bottom below md, with the same title, body and footer", () => {
    stubViewport(375);

    const dialog = renderDialog();

    expect(dialog.closest("[data-slot=drawer-popup]")).not.toBeNull();
    expect(dialog.textContent).toContain("The steps");
    expect(dialog.textContent).toContain("Body");
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });
});
