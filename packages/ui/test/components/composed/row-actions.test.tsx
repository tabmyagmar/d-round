import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowActions } from "../../../src/components/composed/row-actions";

afterEach(cleanup);

describe("RowActions", () => {
  it("lists the actions in order once the menu opens", async () => {
    render(
      <RowActions
        label="Actions for Amy"
        actions={[
          { key: "detail", label: "Detail", render: <a href="/users/1" /> },
          { key: "stop", label: "Stop", destructive: true, onSelect: vi.fn() },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions for Amy" }));
    await screen.findByRole("menu");

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Detail",
      "Stop",
    ]);
    expect(screen.getByRole("menuitem", { name: "Detail" }).getAttribute("href")).toBe("/users/1");
  });

  it("runs the chosen action", async () => {
    const onSelect = vi.fn();
    render(<RowActions label="Actions" actions={[{ key: "stop", label: "Stop", onSelect }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Stop" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders no menu without actions", () => {
    const { container } = render(<RowActions label="Actions" actions={[]} />);

    expect(container.childElementCount).toBe(0);
  });
});
