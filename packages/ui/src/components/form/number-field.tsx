"use client";

import { useState } from "react";
import type { FieldValues } from "react-hook-form";

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "../input-group";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type NumberFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  /** Unit rendered after the input (`円`, `%`, `kg`). */
  unit?: string;
  /** Prefix rendered before the input (`¥`, `$`). */
  prefix?: string;
  /** What an empty input stores (default `null`, matching `z.number().nullable()`). */
  emptyAs?: "null" | "undefined";
  /** `decimal` shows a numeric keypad with a decimal separator on mobile. */
  inputMode?: "numeric" | "decimal";
};

const EMPTY = { null: null, undefined } as const;

const toText = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/**
 * Stores a real `number` (or `null`/`undefined` when empty), never a string, so it fits
 * `z.number()` without `coerce`. Keeps the raw text while typing so `1.` or `-` are not lost.
 */
export const NumberField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  min,
  max,
  step = "any",
  placeholder,
  unit,
  prefix,
  emptyAs = "null",
  inputMode = "decimal",
}: NumberFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const [text, setText] = useState(() => toText(field.value));

  // Re-sync when the form value changes from outside (reset, setValue) and no longer matches
  // what the user typed.
  const external = toText(field.value);
  const typedNumber = text === "" ? "" : toText(Number(text));
  const shown = external === typedNumber ? text : external;

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
      <InputGroup aria-invalid={fieldState.invalid} data-disabled={field.disabled}>
        {prefix ? (
          <InputGroupAddon align="inline-start">
            <InputGroupText>{prefix}</InputGroupText>
          </InputGroupAddon>
        ) : null}
        <InputGroupInput
          id={field.name}
          type="number"
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          name={field.name}
          ref={ref}
          disabled={field.disabled}
          aria-invalid={fieldState.invalid}
          value={shown}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (next === "") {
              field.onChange(EMPTY[emptyAs]);
              return;
            }
            const parsed = Number(next);
            if (Number.isFinite(parsed)) {
              field.onChange(parsed);
            }
          }}
          onBlur={field.onBlur}
        />
        {unit ? (
          <InputGroupAddon align="inline-end">
            <InputGroupText>{unit}</InputGroupText>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </FormFieldShell>
  );
};
