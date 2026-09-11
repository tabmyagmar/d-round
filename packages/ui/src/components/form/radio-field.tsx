"use client";

import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "../field";
import { RadioGroup, RadioGroupItem } from "../radio-group";

import type { BaseFieldProps, SelectOption } from "./types";

export type RadioFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  orientation?: "vertical" | "horizontal";
};

/** One-of-many choice rendered as a radio group; values are strings. */
export const RadioField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  options,
  orientation = "vertical",
}: RadioFieldProps<TValues>) => {
  const { field, fieldState } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });
  const value: unknown = field.value;

  return (
    <FieldSet className={className}>
      <FieldLegend>{label}</FieldLegend>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <RadioGroup
        name={field.name}
        value={typeof value === "string" ? value : null}
        onValueChange={(next) => {
          field.onChange(next);
        }}
        disabled={field.disabled}
        className={orientation === "horizontal" ? "flex flex-row flex-wrap gap-4" : undefined}
      >
        {options.map((option) => (
          <Field key={option.value} orientation="horizontal">
            <RadioGroupItem
              id={`${field.name}-${option.value}`}
              value={option.value}
              disabled={option.disabled}
            />
            <FieldLabel htmlFor={`${field.name}-${option.value}`}>{option.label}</FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      <FieldError errors={[fieldState.error]} />
    </FieldSet>
  );
};
