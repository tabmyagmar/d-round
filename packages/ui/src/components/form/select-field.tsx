"use client";

import { useEffect } from "react";
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
  /**
   * What the field stores: the option value as a string (default) or as a number, for a code the
   * schema keeps as a number (`z.number()`, e.g. a region code); a number field stores `null` when
   * nothing is selected.
   */
  valueAs?: "string" | "number";
  /**
   * Clear the value when `options` no longer offer it — for a select that depends on another
   * (地域 on エリア), as `MultiSelectField`'s. Pass `true` only once the options are authoritative
   * (their data loaded), or a stored value is lost while they load.
   */
  pruneToOptions?: boolean;
};

/**
 * react-hook-form wrapper around `OptionSelect` (the composed select filters and toolbars use on
 * their own). Values are strings unless `valueAs="number"`; parse them in the zod schema. For long
 * or searchable lists use `ComboboxField`.
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
  valueAs = "string",
  pruneToOptions = false,
}: SelectFieldProps<TValues>) => {
  const { field, fieldState } = useFormField({ control, name, disabled });
  const value: unknown = field.value;
  const selected =
    typeof value === "string" && value !== ""
      ? value
      : typeof value === "number"
        ? String(value)
        : null;
  const empty = nullable || valueAs === "number" ? null : "";

  const offeredKey = options.map((option) => option.value).join("\n");
  const { onChange } = field;

  useEffect(() => {
    if (pruneToOptions && selected !== null && !offeredKey.split("\n").includes(selected)) {
      onChange(empty);
    }
  }, [pruneToOptions, offeredKey, selected, onChange, empty]);

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
        value={selected}
        onValueChange={(next) => {
          field.onChange(next === null ? empty : valueAs === "number" ? Number(next) : next);
        }}
        invalid={fieldState.invalid}
        {...(field.disabled === undefined ? {} : { disabled: field.disabled })}
        {...(placeholder === undefined ? {} : { placeholder })}
      />
    </FormFieldShell>
  );
};
