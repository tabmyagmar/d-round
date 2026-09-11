"use client";

import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Checkbox } from "../checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";

import type { BaseFieldProps } from "./types";

export type CheckboxFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues>;

/** Boolean field: checkbox on the left, label and description on the right. */
export const CheckboxField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: CheckboxFieldProps<TValues>) => {
  const { field, fieldState } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });

  return (
    <Field orientation="horizontal" className={className}>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.value === true}
        onCheckedChange={(checked) => {
          field.onChange(checked);
        }}
        onBlur={field.onBlur}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={[fieldState.error]} />
      </div>
    </Field>
  );
};
