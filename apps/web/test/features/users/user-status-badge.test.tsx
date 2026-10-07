// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UserStatusBadge, userStatusOf } from "@/features/users/user-status-badge";

afterEach(cleanup);

describe("userStatusOf", () => {
  it("reads a user without deletedAt as active and one with it as deactivated", () => {
    expect(userStatusOf({ deletedAt: null })).toBe("active");
    expect(userStatusOf({ deletedAt: new Date() })).toBe("deactivated");
  });
});

describe("UserStatusBadge", () => {
  it("labels the two statuses as the legacy app did", () => {
    render(
      <>
        <UserStatusBadge status="active" />
        <UserStatusBadge status="deactivated" />
      </>,
    );

    expect(screen.getByText("利用中")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
  });
});
