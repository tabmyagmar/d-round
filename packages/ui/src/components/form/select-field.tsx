"use client";

import type { FieldValues } from "react-hook-form";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps, SelectOption } from "./types";
import { useFormField } from "./use-form-field";

export type SelectFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  placeholder?: string;
  /** Store `null` when nothing is selected (default: `""`). */
  nullable?: boolean;
};

/**
 * react-hook-form wrapper around the standalone `Select` (which stays usable on its own for
 * filters and toolbars). Values are strings; parse them in the zod schema. For long or searchable
 * lists use `ComboboxField`.
 */
export const SelectField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  options,
  placeholder,
  nullable = false,
}: SelectFieldProps<TValues>) => {
  const { field, fieldState } = useFormField({ control, name, disabled });
  const value: unknown = field.value;

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
    </FormFieldShell>
  );
};
