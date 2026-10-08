"use client";

import { cn } from "cn";
import { useId } from "react";
import type { Ref } from "react";

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
import type { SelectOption } from "../form/types";
import { Label } from "../label";

export type MultiOptionSelectProps<TValue extends string> = {
  options: readonly SelectOption<TValue>[];
  value: readonly TValue[];
  onValueChange: (value: TValue[]) => void;
  /** Visible label above the chips; omit when an outer label points at `id` (form fields). */
  label?: string;
  /** Keeps the label for assistive technology only. */
  hideLabel?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  /** Maximum number of selections; further items are ignored. */
  max?: number;
  /** Server-side search: called with the typed text; pass the fetched `options` back in. */
  onSearch?: (query: string) => void;
  /** Skips the built-in client filter (the options are already the search result). */
  serverFiltered?: boolean;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
};

/**
 * A searchable many-of-many select rendered as chips — for filters (地域, 県名, 雇用区分) and
 * anything that is not a react-hook-form field (`MultiSelectField` wraps it for forms). Values
 * are strings; a value not among `options` shows as a chip with the value itself.
 */
export const MultiOptionSelect = <TValue extends string>({
  options,
  value,
  onValueChange,
  label,
  hideLabel = false,
  placeholder = "Search…",
  emptyMessage = "No results",
  loadingMessage = "Loading…",
  max,
  onSearch,
  serverFiltered = false,
  loading = false,
  disabled,
  invalid,
  id,
  name,
  onBlur,
  inputRef,
  className,
}: MultiOptionSelectProps<TValue>) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const anchor = useComboboxAnchor();
  const selected = value.map(
    (item): SelectOption<TValue> =>
      options.find((option) => option.value === item) ?? { value: item, label: item },
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label
          htmlFor={inputId}
          className={hideLabel ? "sr-only" : "text-xs font-normal text-muted-foreground"}
        >
          {label}
        </Label>
      ) : null}
      <Combobox
        multiple
        items={options}
        value={selected}
        onValueChange={(next: SelectOption<TValue>[]) => {
          const limited = max === undefined ? next : next.slice(0, max);
          onValueChange(limited.map((option) => option.value));
        }}
        itemToStringLabel={(option: SelectOption<TValue>) => option.label}
        isItemEqualToValue={(a: SelectOption<TValue>, b: SelectOption<TValue>) =>
          a.value === b.value
        }
        filter={serverFiltered ? null : undefined}
        onInputValueChange={
          onSearch
            ? (query) => {
                onSearch(query);
              }
            : undefined
        }
        disabled={disabled}
        name={name}
      >
        <ComboboxChips ref={anchor} aria-invalid={invalid}>
          <ComboboxValue>
            {(values: SelectOption<TValue>[]) =>
              values.map((option) => (
                <ComboboxChip key={option.value} aria-label={option.label}>
                  {option.label}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput
            id={inputId}
            ref={inputRef}
            placeholder={selected.length === 0 ? placeholder : undefined}
            disabled={disabled}
            onBlur={onBlur}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{loading ? loadingMessage : emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(option: SelectOption<TValue>) => (
                <ComboboxItem key={option.value} value={option} disabled={option.disabled}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
