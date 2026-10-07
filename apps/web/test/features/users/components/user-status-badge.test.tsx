// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UserStatusBadge } from "@/features/users/components/user-status-badge";

afterEach(cleanup);

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
