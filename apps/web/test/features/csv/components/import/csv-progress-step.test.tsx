// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CsvProgressStep } from "@/features/csv/components/import/csv-progress-step";

import { csvImportOf } from "../../fixtures";

afterEach(cleanup);

describe("CsvProgressStep", () => {
  it("counts the confirmed lines the worker has imported so far", () => {
    render(
      <StrictMode>
        <CsvProgressStep
          csvImport={csvImportOf({ status: "IMPORTING", selectedCount: 5, processedCount: 2 })}
          onClose={vi.fn()}
        />
      </StrictMode>,
    );

    expect(screen.getByRole("status").textContent).toMatch(/登録中… 2 \/ 5 件/u);
  });
});
