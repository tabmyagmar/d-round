"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { Locale, Matcher } from "react-day-picker";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";
import { Calendar } from "../calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

import { compact, formatDate, toDate, toIsoDate } from "./date-utils";
import type { DateLocale } from "./date-utils";
import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type DateFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  /** `iso-date` stores `yyyy-MM-dd` (default, JSON-safe); `date` stores a `Date`. */
  valueAs?: "iso-date" | "date";
  placeholder?: string;
  /** Show a clear button; an empty field stores `null`. */
  nullable?: boolean;
  min?: Date | string;
  max?: Date | string;
  /** Extra days to disable, e.g. weekends: `{ dayOfWeek: [0, 6] }`. */
  disabledDays?: Matcher | Matcher[];
  /** BCP 47 locale for the displayed value (default `ja-JP`). */
  locale?: DateLocale;
  /** react-day-picker locale for the calendar grid (`import { ja } from "react-day-picker/locale"`). */
  calendarLocale?: Locale;
};

/** Date picker in a popover. Stores a `yyyy-MM-dd` string by default. */
export const DateField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  valueAs = "iso-date",
  placeholder = "日付を選択",
  nullable = false,
  min,
  max,
  disabledDays,
  locale,
  calendarLocale,
}: DateFieldProps<TValues>) => {
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
    field.onChange(valueAs === "date" ? date : toIsoDate(date));
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
                className="w-full justify-between font-normal"
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
                emit(date);
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
