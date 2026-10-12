// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionGrant } from "@repo/permissions";
import { AbilityProvider } from "@repo/permissions/react";

import { CsvMenu } from "@/features/csv/containers/csv-menu";
import type { CsvEntity } from "@/features/csv/types";
import { RowSelectionProvider } from "@/stores/row-selection";

import { AM_GRANTS, EVERY_GRANT, userWith } from "../../../support/grants";

// jsdom has no matchMedia; useIsMobile subscribes to one and reads the width from innerWidth.
const stubViewport = (width: number) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

beforeEach(() => {
  stubViewport(1024);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderMenu = (grants: readonly PermissionGrant[], entity: CsvEntity = "user") => {
  render(
    <StrictMode>
      <AbilityProvider user={userWith(grants)}>
        <RowSelectionProvider>
          <CsvMenu entity={entity} />
        </RowSelectionProvider>
      </AbilityProvider>
    </StrictMode>,
  );
};

const itemNames = () => {
  fireEvent.click(screen.getByRole("button", { name: "CSV" }));
  return screen.queryAllByRole("menuitem").map((item) => item.textContent);
};

describe("CsvMenu", () => {
  it("offers 追加, 更新, ダウンロード and 履歴 to someone holding every grant", () => {
    renderMenu(EVERY_GRANT, "staff");

    expect(itemNames()).toEqual(["スタッフを追加", "スタッフを更新", "ダウンロード", "履歴"]);
  });

  it("is not there for an AM, who holds neither CSV grant (catalog 1401 / 1402)", () => {
    renderMenu(AM_GRANTS, "staff");

    expect(screen.queryByRole("button", { name: "CSV" })).toBeNull();
  });

  it("hides 追加 and 更新 without the CSV upload grant (catalog 1401), whatever the entity grants", () => {
    renderMenu([
      { action: "read", subject: "SourceCsvHistory" },
      { action: "create", subject: "User" },
      { action: "update", subject: "User" },
      { action: "read", subject: "User" },
    ]);

    expect(itemNames()).toEqual(["ダウンロード", "履歴"]);
  });

  it("offers each item only with the entity's grant as well", () => {
    renderMenu([
      { action: "create", subject: "SourceCsvHistory" },
      { action: "read", subject: "SourceCsvHistory" },
      { action: "update", subject: "User" },
      { action: "read", subject: "User" },
    ]);

    // No `create User`, no 追加.
    expect(itemNames()).toEqual(["担当者を更新", "ダウンロード", "履歴"]);
  });

  it("is not there without the read of every row, which 履歴 and following an import need", () => {
    renderMenu([
      { action: "create", subject: "SourceCsvHistory" },
      { action: "read", subject: "SourceCsvHistory" },
      { action: "create", subject: "User" },
      { action: "update", subject: "User" },
    ]);

    expect(screen.queryByRole("button", { name: "CSV" })).toBeNull();
  });

  it("lists the items in a drawer from the bottom below md", async () => {
    stubViewport(375);
    renderMenu(EVERY_GRANT, "client");

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));

    const drawer = await screen.findByRole("dialog", { name: "CSV" });
    expect(drawer.closest("[data-slot=drawer-popup]")).not.toBeNull();
    expect(drawer.textContent).toContain("クライアントを追加");
    expect(drawer.textContent).toContain("ダウンロード");
  });
});
