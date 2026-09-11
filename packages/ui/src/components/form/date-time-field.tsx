"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { Locale, Matcher } from "react-day-picker";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";
import { Calendar } from "../calendar";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

import { compact, formatDate, toDate, toTimeString, withTime } from "./date-utils";
import type { DateLocale } from "./date-utils";
import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type DateTimeFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  /** `iso` stores a full ISO 8601 string in UTC (default); `date` stores a `Date`. */
  valueAs?: "iso" | "date";
  placeholder?: string;
  nullable?: boolean;
  min?: Date | string;
  max?: Date | string;
  disabledDays?: Matcher | Matcher[];
  /** Minute granularity of the time input (default 5). */
  minuteStep?: number;
  /** Time used when a date is picked and no time is set yet (default `09:00`). */
  defaultTime?: string;
  locale?: DateLocale;
  calendarLocale?: Locale;
};

/** Date popover plus a time input; the stored value carries both. */
export const DateTimeField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  valueAs = "iso",
  placeholder = "日付を選択",
  nullable = false,
  min,
  max,
  disabledDays,
  minuteStep = 5,
  defaultTime = "09:00",
  locale,
  calendarLocale,
}: DateTimeFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const [open, setOpen] = useState(false);
  const selected = toDate(field.value);
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

  const emit = (date: Date | undefined) => {
    if (!date) {
      field.onChange(null);
      return;
    }
    field.onChange(valueAs === "date" ? date : date.toISOString());
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
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={field.name}
                ref={ref}
                type="button"
                variant="outline"
                className="flex-1 justify-between font-normal"
                disabled={field.disabled}
                aria-invalid={fieldState.invalid}
                onBlur={field.onBlur}
              />
            }
          >
            <span className={selected ? undefined : "text-muted-foreground"}>
              {selected ? formatDate(selected, locale) : placeholder}
            </span>
            <CalendarIcon className="text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              onSelect={(date) => {
                emit(
                  date
                    ? withTime(date, selected ? toTimeString(selected) : defaultTime)
                    : undefined,
                );
                setOpen(false);
              }}
              captionLayout="dropdown"
              disabled={disabledMatchers}
              {...compact({
                selected,
                defaultMonth: selected,
                startMonth: minDate,
                endMonth: maxDate,
                locale: calendarLocale,
              })}
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          aria-label={`${label} time`}
          className="w-28"
          step={minuteStep * 60}
          value={selected ? toTimeString(selected) : ""}
          disabled={Boolean(field.disabled) || !selected}
          aria-invalid={fieldState.invalid}
          onChange={(event) => {
            if (selected && event.target.value) {
              emit(withTime(selected, event.target.value));
            }
          }}
          onBlur={field.onBlur}
        />
        {nullable && selected ? (
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
