"use client";

import type { FieldValues } from "react-hook-form";

import { CheckboxGroup } from "../composed/checkbox-group";
import { FieldDescription, FieldError, FieldSet } from "../field";

import { FormFieldLabel } from "./form-field-label";
import type { BaseFieldProps, SelectOption } from "./types";
import { useFormField } from "./use-form-field";

export type CheckboxGroupFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  orientation?: "vertical" | "horizontal";
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Many-of-many choice; the value is a `string[]` of the checked option values. react-hook-form
 * wrapper around the composed `CheckboxGroup` (the filters use it on their own).
 */
export const CheckboxGroupField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  options,
  orientation = "vertical",
}: CheckboxGroupFieldProps<TValues>) => {
  const { field, fieldState } = useFormField({ control, name, disabled });

  return (
    <FieldSet className={className}>
      <FormFieldLabel asLegend required={required} hint={hint}>
        {label}
      </FormFieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <CheckboxGroup
        options={options}
        value={toStringArray(field.value)}
        onValueChange={field.onChange}
        orientation={orientation}
        disabled={Boolean(field.disabled)}
        invalid={fieldState.invalid}
        idPrefix={field.name}
        name={field.name}
        onBlur={field.onBlur}
      />
      <FieldError errors={[fieldState.error]} />
    </FieldSet>
  );
};
