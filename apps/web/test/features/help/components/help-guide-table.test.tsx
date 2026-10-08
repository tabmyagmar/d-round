// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HelpGuideTable } from "@/features/help/components/help-guide-table";
import { HELP_GUIDES } from "@/features/help/utils/help-guides";

afterEach(cleanup);

describe("HelpGuideTable", () => {
  it("lists the guide book with the legacy columns", () => {
    render(<HelpGuideTable guides={HELP_GUIDES} />);

    expect(screen.getByText("ガイドブック")).toBeDefined();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "資料",
      "バージョン",
      "更新日付",
      "アクション",
    ]);
    expect(screen.getByText("DROUNDガイド")).toBeDefined();
    expect(screen.getByText("2025/12/22")).toBeDefined();
  });

  it("opens the PDF from the download button in a new tab", () => {
    render(<HelpGuideTable guides={HELP_GUIDES} />);

    // Base UI's Button keeps role="button" on the <a> it renders.
    const download = screen.getByRole("button", { name: /ダウンロード/ });
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe("/help/guidebook.pdf");
    expect(download.getAttribute("target")).toBe("_blank");
  });

  it("says so when there is no document", () => {
    render(<HelpGuideTable guides={[]} />);

    expect(screen.getByText("資料がありません")).toBeDefined();
  });
});
