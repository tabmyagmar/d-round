"use client";

import type { ReactNode } from "react";
import type { FieldValues } from "react-hook-form";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type ReadOnlyFieldProps<TValues extends FieldValues> = Omit<
  BaseFieldProps<TValues>,
  "disabled"
> & {
  /** Turns the raw value into what is shown; defaults to `String(value)`. */
  format?: (value: unknown) => ReactNode;
  emptyText?: string;
};

const defaultFormat = (value: unknown): ReactNode => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "はい" : "いいえ";
  }
  if (value instanceof Date) {
    return value.toLocaleString("ja-JP");
  }
  return JSON.stringify(value);
};

/** Label + read-only value for computed or server-owned fields (still validated by the schema). */
export const ReadOnlyField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  className,
  format = defaultFormat,
  emptyText = "—",
}: ReadOnlyFieldProps<TValues>) => {
  const { field, fieldState } = useFormField({ control, name });
  const shown = format(field.value);

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
      <output
        id={field.name}
        name={field.name}
        className="flex min-h-8 w-full items-center rounded-lg border border-input bg-muted/40 px-2.5 py-1 text-sm"
      >
        {shown ?? <span className="text-muted-foreground">{emptyText}</span>}
      </output>
    </FormFieldShell>
  );
};
