// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { PageTitle } from "@/components/layout/page-title";
import { href, routes } from "@/config/routes";

import { AM_GRANTS, userWith } from "../../support/grants";

/** The header title as the shell renders it on `pathname` for a user holding `grants`. */
const renderTitle = (pathname: string, grants: readonly PermissionGrant[] = AM_GRANTS) =>
  render(
    <AbilityProvider user={userWith(grants)}>
      <PageTitle pathname={pathname} />
    </AbilityProvider>,
  );

const breadcrumbNav = () => screen.queryByRole("navigation", { name: "breadcrumb" });

afterEach(cleanup);

describe("PageTitle", () => {
  it("shows a top-level page's title as the h1 without a breadcrumb trail", () => {
    renderTitle(routes.workflow.list.path);

    expect(screen.getByRole("heading", { level: 1, name: "ワークフロー" })).toBeDefined();
    expect(breadcrumbNav()).toBeNull();
  });

  it("puts the trail under the h1 and links a parent page the ability may open", () => {
    renderTitle(routes.client.create.path);

    expect(screen.getByRole("heading", { level: 1, name: "クライアント追加" })).toBeDefined();
    const nav = breadcrumbNav();
    expect(nav).not.toBeNull();
    const parent = within(nav!).getByRole("link", { name: "クライアント管理" });
    expect(parent.getAttribute("href")).toBe(href(routes.client.list));
    expect(within(nav!).getByText("クライアント追加").getAttribute("aria-current")).toBe("page");
  });

  it("shows a parent page the ability may not open as plain text, not a link", () => {
    renderTitle(routes.client.create.path, [{ action: "create", subject: "Client" }]);

    expect(screen.getByRole("heading", { level: 1, name: "クライアント追加" })).toBeDefined();
    const nav = breadcrumbNav();
    expect(nav).not.toBeNull();
    expect(within(nav!).getByText("クライアント管理")).toBeDefined();
    expect(within(nav!).queryByRole("link", { name: "クライアント管理" })).toBeNull();
  });

  it("renders no heading for a path outside the route catalog", () => {
    renderTitle("/admin/nope");

    expect(screen.queryByRole("heading")).toBeNull();
    expect(breadcrumbNav()).toBeNull();
  });
});
