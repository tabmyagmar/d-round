// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeneralStatusBadge } from "@/components/general-status-badge";

afterEach(cleanup);

describe("GeneralStatusBadge", () => {
  it("labels the three statuses as the legacy app did", () => {
    render(
      <>
        <GeneralStatusBadge status="ACTIVE" />
        <GeneralStatusBadge status="INACTIVE" />
        <GeneralStatusBadge status="SUSPENDED" />
      </>,
    );

    expect(screen.getByText("利用中")).toBeDefined();
    expect(screen.getByText("保留")).toBeDefined();
    expect(screen.getByText("停止")).toBeDefined();
  });
});
