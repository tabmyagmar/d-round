"use client";

import type { FieldValues } from "react-hook-form";

import { Field, FieldContent, FieldDescription, FieldError } from "../field";
import { Switch } from "../switch";

import { FormFieldLabel } from "./form-field-label";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type SwitchFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues>;

/** Boolean setting-style field: label and description on the left, switch on the right. */
export const SwitchField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
}: SwitchFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });

  return (
    <Field orientation="horizontal" className={className}>
      <FieldContent>
        <FormFieldLabel htmlFor={field.name} required={required} hint={hint}>
          {label}
        </FormFieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={[fieldState.error]} />
      </FieldContent>
      <Switch
        id={field.name}
        name={field.name}
        inputRef={ref}
        checked={field.value === true}
        onCheckedChange={(checked) => {
          field.onChange(checked);
        }}
        onBlur={field.onBlur}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
      />
    </Field>
  );
};
