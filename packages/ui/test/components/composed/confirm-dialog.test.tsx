import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../../src/components/composed/confirm-dialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("confirms and cancels through its two buttons", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Stop Amy?"
        description="She is signed out."
        confirmLabel="Stop"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Stop Amy?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("disables both buttons while pending", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Stop Amy?"
        confirmLabel="Stop"
        cancelLabel="Cancel"
        pending
        pendingLabel="Stopping…"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Stopping…" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
  });
});
