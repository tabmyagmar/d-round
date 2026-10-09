import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { ja } from "react-day-picker/locale";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { DateField } from "../../../src/components/form/date-field";

afterEach(cleanup);

/** Without a max the year dropdown ends fifty years after this year. */
const LAST_YEAR = String(new Date().getFullYear() + 50);

const Harness = ({ max }: { max?: string }) => {
  const form = useForm<{ hireDate: string | null }>({ defaultValues: { hireDate: "2026-03-15" } });
  return (
    <DateField
      control={form.control}
      name="hireDate"
      label="入社日"
      calendarLocale={ja}
      {...(max === undefined ? {} : { max })}
    />
  );
};

/** Opens the calendar of a harness and returns the year and month it shows. */
const openCalendar = async (max?: string) => {
  render(
    <StrictMode>
      <Harness {...(max === undefined ? {} : { max })} />
    </StrictMode>,
  );
  fireEvent.click(screen.getByLabelText("入社日"));
  await screen.findByRole("grid");
};

/** The year and month (1–12) of the calendar's dropdowns. */
const shown = () => {
  const year = screen.getByRole<HTMLSelectElement>("combobox", { name: "年を選択" }).value;
  const month = Number(screen.getByRole<HTMLSelectElement>("combobox", { name: "月を選択" }).value);
  return `${year}-${String(month + 1)}`;
};

const isDisabled = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("aria-disabled") === "true";

describe("DateField calendar", () => {
  it("steps a year back and forth with << and >>, as the legacy date picker", async () => {
    await openCalendar();
    expect(shown()).toBe("2026-3");

    fireEvent.click(screen.getByRole("button", { name: "次の年へ" }));
    expect(shown()).toBe("2027-3");

    fireEvent.click(screen.getByRole("button", { name: "前の年へ" }));
    fireEvent.click(screen.getByRole("button", { name: "前の年へ" }));
    expect(shown()).toBe("2025-3");
  });

  it("keeps the month buttons beside the year buttons", async () => {
    await openCalendar();

    fireEvent.click(screen.getByRole("button", { name: "次の月へ" }));
    expect(shown()).toBe("2026-4");
  });

  it("reaches fifty years ahead without a max, so a later date can be picked", async () => {
    await openCalendar();

    const years = screen
      .getAllByRole<HTMLOptionElement>("option")
      .map((option) => option.value)
      .filter((value) => value.length === 4);
    expect(years).toContain("2027");
    expect(years.at(-1)).toBe(LAST_YEAR);
  });

  it("stops a year step at the max and then disables the forward buttons", async () => {
    await openCalendar("2026-05-20");

    fireEvent.click(screen.getByRole("button", { name: "次の年へ" }));
    expect(shown()).toBe("2026-5");
    // aria-disabled, as react-day-picker's own buttons: a focused button keeps the focus.
    expect(isDisabled("次の年へ")).toBe(true);
    expect(isDisabled("次の月へ")).toBe(true);
    expect(isDisabled("前の年へ")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "次の年へ" }));
    expect(shown()).toBe("2026-5");
  });
});
