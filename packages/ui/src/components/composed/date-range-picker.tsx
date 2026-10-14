"use client";

import { cn } from "cn";
import { CalendarIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";
import type { Ref } from "react";
import type { DateRange, Locale, Matcher } from "react-day-picker";

import { Button } from "../button";
import { compact, formatDate } from "../form/date-utils";
import type { DateLocale } from "../form/date-utils";
import { FieldCalendar } from "../form/field-calendar";
import { Label } from "../label";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export type DateRangePickerProps = {
  /** The chosen days; `undefined` while none is. */
  value: DateRange | undefined;
  onValueChange: (range: DateRange | undefined) => void;
  /** Visible label above the trigger; omit when an outer label points at `id` (form fields). */
  label?: string;
  /** Keeps the label for assistive technology only (compact toolbars). */
  hideLabel?: boolean;
  placeholder?: string;
  /** Adds a ✕ beside the trigger that clears the range while one is chosen. */
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  numberOfMonths?: 1 | 2;
  min?: Date;
  max?: Date;
  disabledDays?: Matcher[];
  locale?: DateLocale;
  calendarLocale?: Locale;
  id?: string;
  className?: string;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A standalone start/end day picker (期間) on the legacy calendar, `<<` / `>>` stepping a year — for
 * filters and anything that is not a react-hook-form field (`DateRangeField` wraps it). The calendar
 * closes on the second pick since it opened: react-day-picker makes the first pick a one-day range
 * already (`addToRange`), which also stands when the calendar is closed after one pick.
 */
export const DateRangePicker = ({
  value,
  onValueChange,
  label,
  hideLabel = false,
  placeholder = "Pick a period",
  clearable = false,
  clearLabel = "Clear",
  disabled,
  invalid,
  numberOfMonths = 2,
  min,
  max,
  disabledDays = [],
  locale,
  calendarLocale,
  id,
  className,
  onBlur,
  ref,
}: DateRangePickerProps) => {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState(0);
  const disabledMatchers: Matcher[] = [
    ...(min ? [{ before: min }] : []),
    ...(max ? [{ after: max }] : []),
    ...disabledDays,
  ];
  const text = value?.from
    ? `${formatDate(value.from, locale)} 〜 ${value.to ? formatDate(value.to, locale) : ""}`
    : placeholder;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label
          htmlFor={triggerId}
          className={hideLabel ? "sr-only" : "text-xs font-normal text-muted-foreground"}
        >
          {label}
        </Label>
      ) : null}
      <div className="flex items-center gap-1">
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setPicks(0);
          }}
        >
          <PopoverTrigger
            render={
              <Button
                id={triggerId}
                ref={ref}
                type="button"
                variant="outline"
                className="min-w-0 flex-1 justify-between font-normal"
                disabled={disabled}
                aria-invalid={invalid}
                onBlur={onBlur}
              />
            }
          >
            <span className={cn("truncate", value?.from ? undefined : "text-muted-foreground")}>
              {text}
            </span>
            <CalendarIcon className="text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <FieldCalendar
              mode="range"
              onSelect={(next) => {
                onValueChange(next?.from ? next : undefined);
                setPicks(picks + 1);
                if (picks + 1 >= 2 && next?.from && next.to) {
                  setOpen(false);
                }
              }}
              numberOfMonths={numberOfMonths}
              disabled={disabledMatchers}
              {...compact({
                selected: value,
                defaultMonth: value?.from,
                startMonth: min,
                endMonth: max,
                locale: calendarLocale,
              })}
            />
          </PopoverContent>
        </Popover>
        {clearable && value?.from ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={() => {
              onValueChange(undefined);
            }}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
};
