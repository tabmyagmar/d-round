"use client";

import { cn } from "cn";
import { useId } from "react";

import type { SelectOption } from "../form/types";
import { Label } from "../label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

/** The value of the optional "all" item; never reported, it maps to `null`. */
const ALL = "__all__";

export type OptionSelectProps<TValue extends string> = {
  options: readonly SelectOption<TValue>[];
  value: TValue | null;
  onValueChange: (value: TValue | null) => void;
  /** Visible label above the trigger; omit when an outer label points at `id` (form fields). */
  label?: string;
  /** Keeps the label for assistive technology only (compact toolbars). */
  hideLabel?: boolean;
  /** Adds a first item with this label that stands for "no value" (`null`), e.g. "All roles". */
  allOption?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  className?: string;
  triggerClassName?: string;
};

/**
 * A standalone select over `options` — for filters, toolbars and anything that is not a
 * react-hook-form field (`SelectField` wraps it for forms). Values are strings.
 */
export const OptionSelect = <TValue extends string>({
  options,
  value,
  onValueChange,
  label,
  hideLabel = false,
  allOption,
  placeholder,
  disabled,
  invalid,
  id,
  name,
  className,
  triggerClassName,
}: OptionSelectProps<TValue>) => {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const items: readonly SelectOption[] = allOption
    ? [{ value: ALL, label: allOption }, ...options]
    : options;

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
      <Select
        items={items.map((item) => ({ value: item.value, label: item.label }))}
        value={value ?? (allOption ? ALL : null)}
        onValueChange={(next) => {
          onValueChange(next === null || next === ALL ? null : (next as TValue));
        }}
        {...(disabled === undefined ? {} : { disabled })}
        {...(name === undefined ? {} : { name })}
      >
        <SelectTrigger
          id={triggerId}
          className={cn("w-full", triggerClassName)}
          aria-invalid={invalid}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
