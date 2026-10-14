"use client";

import type { DateRange, Locale, Matcher } from "react-day-picker";
import type { FieldValues } from "react-hook-form";

import { DateRangePicker } from "../composed/date-range-picker";

import { compact, toDate, toIsoDate } from "./date-utils";
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

/** Start/end date picker (期間) for a form: `DateRangePicker` storing `{ from, to }`. */
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

  const convert = (date: Date | undefined) =>
    date ? (valueAs === "date" ? date : toIsoDate(date)) : null;

  const emit = (next: DateRange | undefined) => {
    if (!next?.from) {
      field.onChange(nullable ? null : { from: null, to: null });
      return;
    }
    field.onChange({ from: convert(next.from), to: convert(next.to) });
  };

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
      <DateRangePicker
        id={field.name}
        ref={ref}
        value={readRange(field.value)}
        onValueChange={emit}
        placeholder={placeholder}
        clearable={nullable}
        invalid={fieldState.invalid}
        onBlur={field.onBlur}
        numberOfMonths={numberOfMonths}
        disabledDays={
          disabledDays === undefined
            ? []
            : Array.isArray(disabledDays)
              ? disabledDays
              : [disabledDays]
        }
        {...compact({
          disabled: field.disabled,
          min: toDate(min),
          max: toDate(max),
          locale,
          calendarLocale,
        })}
      />
    </FormFieldShell>
  );
};
