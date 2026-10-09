"use client";

import { useMemo } from "react";
import type { FieldValues } from "react-hook-form";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../combobox";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps, SelectOption } from "./types";
import { useFormField } from "./use-form-field";

export type ComboboxFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  options: readonly SelectOption[];
  placeholder?: string;
  /** Store `null` when cleared (default: `""`). */
  nullable?: boolean;
  emptyMessage?: string;
  /**
   * Server-side search: called with the typed text; pass the fetched `options` back in and set
   * `serverFiltered` so the built-in client filter is skipped.
   */
  onSearch?: (query: string) => void;
  serverFiltered?: boolean;
  loading?: boolean;
};

/** Searchable single select. Stores the option `value` string. */
export const ComboboxField = <TValues extends FieldValues>({
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
  nullable = false,
  emptyMessage = "該当なし",
  onSearch,
  serverFiltered = false,
  loading = false,
}: ComboboxFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const chosen = options.find((option) => option.value === field.value);
  const chosenValue = chosen?.value;
  const chosenLabel = chosen?.label;
  // One object while the chosen option stays the same: Base UI puts the chosen label back into the
  // input whenever the value changes identity, which would undo a search typed over a chosen value
  // as soon as its results render the field again with fresh options.
  const selected = useMemo<SelectOption | null>(
    () =>
      chosenValue === undefined || chosenLabel === undefined
        ? null
        : { value: chosenValue, label: chosenLabel },
    [chosenValue, chosenLabel],
  );

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
      <Combobox
        items={options}
        value={selected}
        onValueChange={(next: SelectOption | null) => {
          field.onChange(next?.value ?? (nullable ? null : ""));
        }}
        itemToStringLabel={(option: SelectOption) => option.label}
        isItemEqualToValue={(a: SelectOption, b: SelectOption) => a.value === b.value}
        filter={serverFiltered ? null : undefined}
        onInputValueChange={
          onSearch
            ? (query) => {
                onSearch(query);
              }
            : undefined
        }
        disabled={field.disabled}
        name={field.name}
      >
        <ComboboxInput
          id={field.name}
          ref={ref}
          placeholder={placeholder}
          showClear={nullable}
          disabled={field.disabled}
          aria-invalid={fieldState.invalid}
          onBlur={field.onBlur}
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{loading ? "読み込み中…" : emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(option: SelectOption) => (
                <ComboboxItem key={option.value} value={option} disabled={option.disabled}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormFieldShell>
  );
};
