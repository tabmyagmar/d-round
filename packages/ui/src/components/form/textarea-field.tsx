"use client";

import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Textarea } from "../textarea";

import type { BaseFieldProps } from "./types";

const EMPTY_VALUES = { string: "", null: null, undefined } as const;

export type TextareaFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  placeholder?: string;
  rows?: number;
  emptyAs?: "string" | "null" | "undefined";
};

export const TextareaField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
  placeholder,
  rows,
  emptyAs = "string",
}: TextareaFieldProps<TValues>) => {
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
      <Textarea
        id={field.name}
        placeholder={placeholder}
        rows={rows}
        name={field.name}
        ref={ref}
        disabled={field.disabled}
        aria-invalid={fieldState.invalid}
        value={typeof value === "string" ? value : ""}
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
