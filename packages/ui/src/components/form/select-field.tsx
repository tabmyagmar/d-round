"use client";

import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

import type { BaseFieldProps, SelectOption } from "./types";

export type SelectFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  placeholder?: string;
  /** Store `null` when nothing is selected (default: leave the value untouched). */
  nullable?: boolean;
};

/**
 * react-hook-form wrapper around the standalone `Select` (which stays usable on its own for
 * filters and toolbars). Values are strings; parse them in the zod schema.
 */
export const SelectField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  options,
  placeholder,
  nullable = false,
}: SelectFieldProps<TValues>) => {
  const { field, fieldState } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });
  const value: unknown = field.value;

  return (
    <Field className={className}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        items={options.map(({ value: optionValue, label: optionLabel }) => ({
          value: optionValue,
          label: optionLabel,
        }))}
        value={typeof value === "string" ? value : null}
        onValueChange={(next) => {
          field.onChange(next ?? (nullable ? null : ""));
        }}
        disabled={field.disabled}
        name={field.name}
      >
        <SelectTrigger id={field.name} className="w-full" aria-invalid={fieldState.invalid}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[fieldState.error]} />
    </Field>
  );
};
