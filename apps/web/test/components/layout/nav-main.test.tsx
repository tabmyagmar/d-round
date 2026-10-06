// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { NavMain } from "@/components/layout/nav-main";
import { NAV_GROUPS } from "@/config/nav";
import type { NavGroup } from "@/config/nav";
import { routes } from "@/config/routes";

/** The real main group (ホーム, マスター管理 with its children, …), not a hand-built copy. */
const mainGroup = (): NavGroup => {
  const group = NAV_GROUPS.find((candidate) => candidate.id === "main");
  if (!group) {
    throw new Error("NAV_GROUPS has no main group");
  }
  return group;
};

const AUDIT_LOG = routes.auditLog.list;

/** The group as the shell renders it on `pathname`; the provider stays the same across calls. */
const navOn = (pathname: string) => (
  <SidebarProvider>
    <NavMain group={mainGroup()} pathname={pathname} />
  </SidebarProvider>
);

beforeAll(() => {
  // jsdom has no matchMedia; the sidebar's useIsMobile subscribes to one (desktop width here).
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(cleanup);

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("NavMain", () => {
  it("keeps マスター管理 closed while none of its children is the page", () => {
    render(navOn(routes.home.path));
    expect(screen.getByText("マスター管理")).toBeDefined();
    expect(screen.queryByText(AUDIT_LOG.title)).toBeNull();
  });

  it("opens マスター管理 on load when one of its children is the page", () => {
    render(navOn(AUDIT_LOG.path));
    expect(screen.getByText(AUDIT_LOG.title)).toBeDefined();
  });

  it("reopens マスター管理 when a child becomes the page by soft navigation (no remount)", () => {
    const { rerender } = render(navOn(routes.home.path));
    expect(screen.queryByText(AUDIT_LOG.title)).toBeNull();

    rerender(navOn(AUDIT_LOG.path));
    expect(screen.getByText(AUDIT_LOG.title)).toBeDefined();
  });
});
