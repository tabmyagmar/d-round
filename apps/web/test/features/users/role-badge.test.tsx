// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoleBadge } from "@/features/users/role-badge";

afterEach(cleanup);

describe("RoleBadge", () => {
  it("shows the human label for a known role", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("Admin")).toBeDefined();
  });

  it("shows the raw value for an unknown role instead of crashing", () => {
    render(<RoleBadge role="ceo" />);
    expect(screen.getByText("ceo")).toBeDefined();
  });
});
