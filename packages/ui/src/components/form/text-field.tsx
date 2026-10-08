"use client";

import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";

import { Input } from "../input";

import { FormFieldShell } from "./form-field-shell";
import { EMPTY_VALUES } from "./types";
import type { BaseFieldProps, EmptyAs } from "./types";
import { useFormField } from "./use-form-field";

export type TextFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  type?: "text" | "email" | "url" | "tel" | "search";
  placeholder?: string;
  autoComplete?: ComponentProps<"input">["autoComplete"];
  /** Shows a `n / max` counter and caps the input length. */
  maxLength?: number;
  /** What a cleared input stores: "" (default), null (nullable fields) or undefined (optional). */
  emptyAs?: EmptyAs;
  /** Called with the typed text after the field changed, e.g. to look something up as it is typed. */
  onValueChange?: (text: string) => void;
};

/** Label + input + description + error, wired to react-hook-form. Numbers: see `NumberField`. */
export const TextField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  emptyAs = "string",
  onValueChange,
}: TextFieldProps<TValues>) => {
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
      <Input
        id={field.name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        name={field.name}
        ref={ref}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          field.onChange(next === "" ? EMPTY_VALUES[emptyAs] : next);
          onValueChange?.(next);
        }}
        onBlur={field.onBlur}
      />
    </FormFieldShell>
  );
};
