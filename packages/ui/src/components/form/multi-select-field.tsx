"use client";

import type { FieldValues } from "react-hook-form";

import { MultiOptionSelect } from "../composed/multi-option-select";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps, SelectOption } from "./types";
import { useFormField } from "./use-form-field";

export type MultiSelectFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  /** Maximum number of selections; further items are ignored. */
  max?: number;
  onSearch?: (query: string) => void;
  serverFiltered?: boolean;
  loading?: boolean;
  /**
   * What the field stores: the option values as strings (default) or as numbers, for ids and
   * codes the schema keeps as numbers (`z.array(z.number())`, e.g. region codes).
   */
  valueAs?: "string" | "number";
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string" ? [item] : typeof item === "number" ? [String(item)] : [],
      )
    : [];

/**
 * Searchable many-of-many select rendered as chips. Stores a `string[]` of option values, or a
 * `number[]` with `valueAs="number"`. react-hook-form wrapper around the composed
 * `MultiOptionSelect` (the filters use it on their own).
 */
export const MultiSelectField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  options,
  placeholder = "検索…",
  emptyMessage = "該当なし",
  max,
  onSearch,
  serverFiltered = false,
  loading = false,
  valueAs = "string",
}: MultiSelectFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });

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
      <MultiOptionSelect
        id={field.name}
        name={field.name}
        inputRef={ref}
        options={options}
        value={toStringArray(field.value)}
        onValueChange={(next) => {
          field.onChange(valueAs === "number" ? next.map(Number) : next);
        }}
        onBlur={field.onBlur}
        invalid={fieldState.invalid}
        disabled={Boolean(field.disabled)}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        loadingMessage="読み込み中…"
        serverFiltered={serverFiltered}
        loading={loading}
        {...(max === undefined ? {} : { max })}
        {...(onSearch === undefined ? {} : { onSearch })}
      />
    </FormFieldShell>
  );
};
