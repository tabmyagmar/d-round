"use client";

import type { FieldValues } from "react-hook-form";

import { Textarea } from "../textarea";

import { FormFieldShell } from "./form-field-shell";
import { EMPTY_VALUES } from "./types";
import type { BaseFieldProps, EmptyAs } from "./types";
import { useFormField } from "./use-form-field";

export type TextareaFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  placeholder?: string;
  rows?: number;
  /** Shows a `n / max` counter and caps the input length. */
  maxLength?: number;
  emptyAs?: EmptyAs;
};

export const TextareaField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  placeholder,
  rows,
  maxLength,
  emptyAs = "string",
}: TextareaFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const value: unknown = field.value;
  const text = typeof value === "string" ? value : "";

  return (
    <FormFieldShell
      htmlFor={field.name}
      label={label}
      required={required}
      hint={hint}
      description={description}
      error={fieldState.error}
      counter={maxLength === undefined ? undefined : { length: text.length, max: maxLength }}
      className={className}
    >
      <Textarea
        id={field.name}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        name={field.name}
        ref={ref}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          field.onChange(next === "" ? EMPTY_VALUES[emptyAs] : next);
        }}
        onBlur={field.onBlur}
      />
    </FormFieldShell>
  );
};
