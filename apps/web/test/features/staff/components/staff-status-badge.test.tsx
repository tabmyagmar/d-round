// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StaffStatusBadge } from "@/features/staff/components/staff-status-badge";

afterEach(cleanup);

describe("StaffStatusBadge", () => {
  it("labels the three statuses as the legacy app did", () => {
    render(
      <>
        <StaffStatusBadge status="ACTIVE" />
        <StaffStatusBadge status="INACTIVE" />
        <StaffStatusBadge status="SUSPENDED" />
      </>,
    );

    expect(screen.getByText("利用中")).toBeDefined();
    expect(screen.getByText("保留")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
  });
});
