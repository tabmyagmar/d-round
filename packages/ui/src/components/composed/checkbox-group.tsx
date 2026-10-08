"use client";

import { cn } from "cn";
import { useId } from "react";

import { Checkbox } from "../checkbox";
import { Field, FieldLabel, FieldLegend, FieldSet } from "../field";
import type { SelectOption } from "../form/types";

export type CheckboxGroupProps<TValue extends string> = {
  options: readonly SelectOption<TValue>[];
  value: readonly TValue[];
  onValueChange: (value: TValue[]) => void;
  /** Visible group label (a legend); omit when an outer legend names the group (form fields). */
  label?: string;
  /** Keeps the label for assistive technology only. */
  hideLabel?: boolean;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  invalid?: boolean;
  /** Prefix of the checkboxes' ids; defaults to a generated one. */
  idPrefix?: string;
  name?: string;
  onBlur?: () => void;
  className?: string;
};

/**
 * Several checkboxes over `options` — for filters (ステータス, 性別, エリア) and anything that is not
 * a react-hook-form field (`CheckboxGroupField` wraps it for forms). Checking appends the value,
 * unchecking removes it; values not among `options` are kept.
 */
export const CheckboxGroup = <TValue extends string>({
  options,
  value,
  onValueChange,
  label,
  hideLabel = false,
  orientation = "vertical",
  disabled,
  invalid,
  idPrefix,
  name,
  onBlur,
  className,
}: CheckboxGroupProps<TValue>) => {
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const boxes = (
    <div
      className={
        orientation === "horizontal" ? "flex flex-row flex-wrap gap-4" : "flex flex-col gap-2"
      }
    >
      {options.map((option) => {
        const id = `${prefix}-${option.value}`;
        return (
          <Field
            key={option.value}
            orientation="horizontal"
            // A Field takes the full width; side by side, each box takes only its own.
            {...(orientation === "horizontal" ? { className: "w-auto" } : {})}
          >
            <Checkbox
              id={id}
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              disabled={Boolean(disabled) || Boolean(option.disabled)}
              aria-invalid={invalid}
              onBlur={onBlur}
              onCheckedChange={(checked) => {
                onValueChange(
                  checked
                    ? [...value, option.value]
                    : value.filter((item) => item !== option.value),
                );
              }}
            />
            <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
          </Field>
        );
      })}
    </div>
  );

  if (!label) {
    return <div className={className}>{boxes}</div>;
  }
  return (
    <FieldSet className={cn("gap-1.5", className)}>
      <FieldLegend
        variant="label"
        className={hideLabel ? "sr-only" : "mb-0 text-xs font-normal text-muted-foreground"}
      >
        {label}
      </FieldLegend>
      {boxes}
    </FieldSet>
  );
};
