"use client";

import type { FieldValues } from "react-hook-form";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "../combobox";

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
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** Searchable many-of-many select rendered as chips. Stores a `string[]` of option values. */
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
}: MultiSelectFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const anchor = useComboboxAnchor();
  const selectedValues = toStringArray(field.value);
  const selected = selectedValues.flatMap((value) => {
    const option = options.find((candidate) => candidate.value === value);
    return option ? [option] : [{ value, label: value }];
  });

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
        multiple
        items={options}
        value={selected}
        onValueChange={(next: SelectOption[]) => {
          const limited = max === undefined ? next : next.slice(0, max);
          field.onChange(limited.map((option) => option.value));
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
        <ComboboxChips ref={anchor} aria-invalid={fieldState.invalid}>
          <ComboboxValue>
            {(values: SelectOption[]) =>
              values.map((option) => (
                <ComboboxChip key={option.value} aria-label={option.label}>
                  {option.label}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput
            id={field.name}
            ref={ref}
            placeholder={selected.length === 0 ? placeholder : undefined}
            disabled={field.disabled}
            onBlur={field.onBlur}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
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
