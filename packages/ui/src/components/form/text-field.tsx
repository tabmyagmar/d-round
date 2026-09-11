"use client";

import type { ComponentProps } from "react";
import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";

import type { BaseFieldProps } from "./types";

const EMPTY_VALUES = { string: "", null: null, undefined } as const;

export type TextFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  type?: "text" | "email" | "url" | "tel" | "number" | "search";
  placeholder?: string;
  autoComplete?: ComponentProps<"input">["autoComplete"];
  /** What a cleared input stores: "" (default), null (nullable fields) or undefined (optional fields). */
  emptyAs?: "string" | "null" | "undefined";
};

/** Label + input + description + error, wired to react-hook-form through `useController`. */
export const TextField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  type = "text",
  placeholder,
  autoComplete,
  emptyAs = "string",
}: TextFieldProps<TValues>) => {
  // `ref` is pulled out so the React Compiler lint (react-hooks/refs) does not treat the whole
  // `field` object as a ref; it is only ever forwarded to the input element.
  const {
    field: { ref, ...field },
    fieldState,
  } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });
  const value: unknown = field.value;

  return (
    <Field className={className}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        name={field.name}
        ref={ref}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        onChange={(event) => {
          const next = event.target.value;
          field.onChange(next === "" ? EMPTY_VALUES[emptyAs] : next);
        }}
        onBlur={field.onBlur}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[fieldState.error]} />
    </Field>
  );
};
