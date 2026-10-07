// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ROLES } from "@repo/validation";

import { ROLE_LABELS, RoleBadge } from "@/features/users/role-badge";

afterEach(cleanup);

describe("RoleBadge", () => {
  it("shows the legacy Japanese label for a known role", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("アドミン")).toBeDefined();
  });

  it.each(ROLES)("shows the human label for %s, never the raw key", (role) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(ROLE_LABELS[role])).toBeDefined();
    expect(screen.queryByText(role)).toBeNull();
  });

  it("shows the raw value for an unknown role instead of crashing", () => {
    render(<RoleBadge role="ceo" />);
    expect(screen.getByText("ceo")).toBeDefined();
  });
});
