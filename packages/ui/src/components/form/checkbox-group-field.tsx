"use client";

import type { FieldValues } from "react-hook-form";

import { Checkbox } from "../checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldSet } from "../field";

import { FormFieldLabel } from "./form-field-label";
import type { BaseFieldProps, SelectOption } from "./types";
import { useFormField } from "./use-form-field";

export type CheckboxGroupFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  orientation?: "vertical" | "horizontal";
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Many-of-many choice; the value is a `string[]` of the checked option values. */
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
  const selected = toStringArray(field.value);

  return (
    <FieldSet className={className}>
      <FormFieldLabel asLegend required={required} hint={hint}>
        {label}
      </FormFieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <div
        className={
          orientation === "horizontal" ? "flex flex-row flex-wrap gap-4" : "flex flex-col gap-2"
        }
      >
        {options.map((option) => {
          const id = `${field.name}-${option.value}`;
          return (
            <Field key={option.value} orientation="horizontal">
              <Checkbox
                id={id}
                name={field.name}
                value={option.value}
                checked={selected.includes(option.value)}
                disabled={Boolean(field.disabled) || Boolean(option.disabled)}
                aria-invalid={fieldState.invalid}
                onBlur={field.onBlur}
                onCheckedChange={(checked) => {
                  field.onChange(
                    checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  );
                }}
              />
              <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
            </Field>
          );
        })}
      </div>
      <FieldError errors={[fieldState.error]} />
    </FieldSet>
  );
};
