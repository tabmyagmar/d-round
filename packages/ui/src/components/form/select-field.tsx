"use client";

import type { FieldValues } from "react-hook-form";

import { OptionSelect } from "../composed/option-select";

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
 * react-hook-form wrapper around `OptionSelect` (the composed select filters and toolbars use on
 * their own). Values are strings; parse them in the zod schema. For long or searchable
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
      <OptionSelect
        id={field.name}
        name={field.name}
        options={options}
        value={typeof value === "string" ? value : null}
        onValueChange={(next) => {
          field.onChange(next ?? (nullable ? null : ""));
        }}
        invalid={fieldState.invalid}
        {...(field.disabled === undefined ? {} : { disabled: field.disabled })}
        {...(placeholder === undefined ? {} : { placeholder })}
      />
    </FormFieldShell>
  );
};
