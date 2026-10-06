import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LoadingState } from "../../../src/components/composed/loading-state";

afterEach(cleanup);

describe("LoadingState", () => {
  it("announces a status with the default message", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status").textContent).toBe("Loading…");
  });

  it("shows the given message", () => {
    render(<LoadingState message="読み込み中..." />);
    expect(screen.getByRole("status").textContent).toBe("読み込み中...");
  });

  it("exposes one status only: the spinner icon is hidden from assistive tech", () => {
    const { container } = render(<LoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
