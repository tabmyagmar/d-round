"use client";

import type { FieldValues } from "react-hook-form";

import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type HiddenFieldProps<TValues extends FieldValues> = Pick<
  BaseFieldProps<TValues>,
  "control" | "name"
>;

/** Keeps a value registered (and posted with native form submits) without rendering a control. */
export const HiddenField = <TValues extends FieldValues>({
  control,
  name,
}: HiddenFieldProps<TValues>) => {
  const { field } = useFormField({ control, name });
  const value: unknown = field.value;
  const text =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
  return <input type="hidden" name={field.name} value={text} />;
};
