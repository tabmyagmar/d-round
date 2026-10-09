"use client";

import { cn } from "cn";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useDayPicker } from "react-day-picker";
import type { NavProps } from "react-day-picker";

import { Calendar } from "../calendar";

/** Without an `endMonth`, the dropdowns reach December fifty years ahead (legacy `InputDatePicker`). */
const DEFAULT_END_MONTH = new Date(new Date().getFullYear() + 50, 11, 1);

/**
 * The legacy date picker's navigation: `<<` `<` (year and month dropdowns) `>` `>>`. A year button
 * moves the shown month twelve months, clamped by `goToMonth` to the start and end month, and is
 * disabled with the month button beside it. Disabled buttons stay focusable (`aria-disabled`), as
 * react-day-picker's own `Nav`. Four buttons share the row with the dropdowns, so they are smaller
 * than a day cell.
 */
const YearMonthNav = ({
  onPreviousClick,
  onNextClick,
  previousMonth,
  nextMonth,
  ...navProps
}: NavProps) => {
  const { months, goToMonth, labels, classNames, dayPickerProps } = useDayPicker();
  // react-day-picker names only the month buttons (ja: 前の月へ / 次の月へ, en: Go to the Previous
  // Month / Go to the Next Month); the year buttons follow suit.
  const year =
    dayPickerProps.locale?.code === "ja"
      ? { previous: "前の年へ", next: "次の年へ" }
      : { previous: "Go to the Previous Year", next: "Go to the Next Year" };
  const shown = months[0]?.date;
  const atStart = !previousMonth;
  const atEnd = !nextMonth;

  const stepYear = (years: number) => {
    if (shown) {
      goToMonth(new Date(shown.getFullYear() + years, shown.getMonth(), 1));
    }
  };

  return (
    <nav {...navProps}>
      <div className="flex gap-0.5">
        <button
          type="button"
          className={cn(classNames.button_previous, "size-6")}
          aria-label={year.previous}
          aria-disabled={atStart || undefined}
          tabIndex={atStart ? -1 : undefined}
          onClick={() => {
            if (!atStart) {
              stepYear(-1);
            }
          }}
        >
          <ChevronsLeftIcon />
        </button>
        <button
          type="button"
          className={cn(classNames.button_previous, "size-6")}
          aria-label={labels.labelPrevious(previousMonth)}
          aria-disabled={atStart || undefined}
          tabIndex={atStart ? -1 : undefined}
          onClick={(event) => {
            if (!atStart) {
              onPreviousClick?.(event);
            }
          }}
        >
          <ChevronLeftIcon />
        </button>
      </div>
      <div className="flex gap-0.5">
        <button
          type="button"
          className={cn(classNames.button_next, "size-6")}
          aria-label={labels.labelNext(nextMonth)}
          aria-disabled={atEnd || undefined}
          tabIndex={atEnd ? -1 : undefined}
          onClick={(event) => {
            if (!atEnd) {
              onNextClick?.(event);
            }
          }}
        >
          <ChevronRightIcon />
        </button>
        <button
          type="button"
          className={cn(classNames.button_next, "size-6")}
          aria-label={year.next}
          aria-disabled={atEnd || undefined}
          tabIndex={atEnd ? -1 : undefined}
          onClick={() => {
            if (!atEnd) {
              stepYear(1);
            }
          }}
        >
          <ChevronsRightIcon />
        </button>
      </div>
    </nav>
  );
};

/**
 * The calendar of `DateField`, `DateTimeField` and `DateRangeField`: year and month dropdowns
 * between `<<` `<` and `>` `>>` (legacy `InputDatePicker`), reaching fifty years ahead unless an
 * `endMonth` is given, in 32 px cells (the legacy size, so the four buttons fit).
 */
export const FieldCalendar = ({ endMonth, ...props }: ComponentProps<typeof Calendar>) => (
  <Calendar
    captionLayout="dropdown"
    className="[--cell-size:--spacing(8)]"
    components={{ Nav: YearMonthNav }}
    endMonth={endMonth ?? DEFAULT_END_MONTH}
    {...props}
  />
);
