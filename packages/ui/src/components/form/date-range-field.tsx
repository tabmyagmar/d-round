"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange, Locale, Matcher } from "react-day-picker";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";
import { Calendar } from "../calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

import { compact, formatDate, toDate, toIsoDate } from "./date-utils";
import type { DateLocale } from "./date-utils";
import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

/** Stored shape: both ends `yyyy-MM-dd` (or `Date` with `valueAs="date"`), `null` when unset. */
export type DateRangeValue<TDate = string> = { from: TDate | null; to: TDate | null };

export type DateRangeFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  valueAs?: "iso-date" | "date";
  placeholder?: string;
  nullable?: boolean;
  min?: Date | string;
  max?: Date | string;
  disabledDays?: Matcher | Matcher[];
  numberOfMonths?: 1 | 2;
  locale?: DateLocale;
  calendarLocale?: Locale;
};

const readRange = (value: unknown): DateRange | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { from, to } = value as { from?: unknown; to?: unknown };
  const fromDate = toDate(from);
  if (!fromDate) {
    return undefined;
  }
  return { from: fromDate, to: toDate(to) };
};

/** Start/end date picker (期間). Stores `{ from, to }`. */
export const DateRangeField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  valueAs = "iso-date",
  placeholder = "期間を選択",
  nullable = false,
  min,
  max,
  disabledDays,
  numberOfMonths = 2,
  locale,
  calendarLocale,
}: DateRangeFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const [open, setOpen] = useState(false);
  const range = readRange(field.value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const disabledMatchers: Matcher[] = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
    ...(disabledDays === undefined
      ? []
      : Array.isArray(disabledDays)
        ? disabledDays
        : [disabledDays]),
  ];

  const convert = (date: Date | undefined) =>
    date ? (valueAs === "date" ? date : toIsoDate(date)) : null;

  const emit = (next: DateRange | undefined) => {
    if (!next?.from) {
      field.onChange(nullable ? null : { from: null, to: null });
      return;
    }
    field.onChange({ from: convert(next.from), to: convert(next.to) });
  };

  const text = range?.from
    ? `${formatDate(range.from, locale)} 〜 ${range.to ? formatDate(range.to, locale) : ""}`
    : placeholder;

  return (
    <FormFieldShell
      htmlFor={field.name}
      label={label}
      required={required}
      hint={hint}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={field.name}
                ref={ref}
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                disabled={field.disabled}
                aria-invalid={fieldState.invalid}
                onBlur={field.onBlur}
              />
            }
          >
            <span className={range?.from ? undefined : "text-muted-foreground"}>{text}</span>
            <CalendarIcon className="text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              onSelect={(next) => {
                emit(next);
                if (next?.from && next.to) {
                  setOpen(false);
                }
              }}
              numberOfMonths={numberOfMonths}
              captionLayout="dropdown"
              disabled={disabledMatchers}
              {...compact({
                selected: range,
                defaultMonth: range?.from,
                startMonth: minDate,
                endMonth: maxDate,
                locale: calendarLocale,
              })}
            />
          </PopoverContent>
        </Popover>
        {nullable && range?.from ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear"
            disabled={field.disabled}
            onClick={() => {
              emit(undefined);
            }}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </FormFieldShell>
  );
};
