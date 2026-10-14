// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AbilityProvider } from "@repo/permissions/react";

import { AuditHistoryButton } from "@/features/audit-log/components/history/audit-history-button";

import { AM_GRANTS, userWith } from "../../../../support/grants";

afterEach(cleanup);

const renderAs = (grants: Parameters<typeof userWith>[0]) =>
  render(
    <AbilityProvider user={userWith(grants)}>
      <AuditHistoryButton entityType="Client" entityId={crypto.randomUUID()} />
    </AbilityProvider>,
  );

describe("AuditHistoryButton", () => {
  it("is offered to those who may read the audit log", () => {
    renderAs([{ action: "read", subject: "AuditLog" }]);

    expect(screen.getByRole("button", { name: "変更履歴" })).toBeDefined();
  });

  it("is not offered to an AM", () => {
    renderAs(AM_GRANTS);

    expect(screen.queryByRole("button", { name: "変更履歴" })).toBeNull();
  });
});
