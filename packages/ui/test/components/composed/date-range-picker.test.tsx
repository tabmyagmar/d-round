import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import type { DateRange } from "react-day-picker";
import { ja } from "react-day-picker/locale";
import { afterEach, describe, expect, it } from "vitest";

import { DateRangePicker } from "../../../src/components/composed/date-range-picker";

afterEach(cleanup);

/** A controlled picker that keeps every range it was handed. */
const Harness = ({
  initial,
  changes,
}: {
  initial?: DateRange;
  changes: (DateRange | undefined)[];
}) => {
  const [value, setValue] = useState<DateRange | undefined>(initial);
  return (
    <DateRangePicker
      label="期間"
      value={value}
      onValueChange={(next) => {
        changes.push(next);
        setValue(next);
      }}
      placeholder="期間を選択"
      clearable
      clearLabel="期間をクリア"
      numberOfMonths={1}
      calendarLocale={ja}
    />
  );
};

const renderPicker = (initial?: DateRange) => {
  const changes: (DateRange | undefined)[] = [];
  render(
    <StrictMode>
      <Harness changes={changes} {...(initial ? { initial } : {})} />
    </StrictMode>,
  );
  return changes;
};

/** The calendar's button of a day of the month it shows. */
const dayButton = (day: number) => {
  const button = screen
    .getAllByRole("button")
    .find((element) => element.textContent === String(day) && element.closest("[role='grid']"));
  if (!button) {
    throw new Error(`no button for day ${String(day)}`);
  }
  return button;
};

describe("DateRangePicker", () => {
  it("picks a period and closes once both ends are chosen", async () => {
    const changes = renderPicker();
    expect(screen.getByLabelText("期間").textContent).toContain("期間を選択");

    fireEvent.click(screen.getByLabelText("期間"));
    await screen.findByRole("grid");
    fireEvent.click(dayButton(10));
    // The first pick is a one-day range already; the calendar stays for the end.
    expect(changes.at(-1)?.to?.getDate()).toBe(10);
    expect(screen.getByRole("grid")).toBeDefined();
    fireEvent.click(dayButton(20));

    expect(changes.at(-1)?.from?.getDate()).toBe(10);
    expect(changes.at(-1)?.to?.getDate()).toBe(20);
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.getByLabelText("期間").textContent).toContain("〜");
  });

  it("shows a given period and clears it with ✕", () => {
    const changes = renderPicker({ from: new Date(2026, 2, 1), to: new Date(2026, 2, 31) });
    expect(screen.getByLabelText("期間").textContent).toMatch(/2026.*〜.*2026/u);

    fireEvent.click(screen.getByRole("button", { name: "期間をクリア" }));

    expect(changes).toEqual([undefined]);
    expect(screen.getByLabelText("期間").textContent).toContain("期間を選択");
    expect(screen.queryByRole("button", { name: "期間をクリア" })).toBeNull();
  });
});
