"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useWatch } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { ComboboxField } from "@repo/ui/components/form";
import type { ComboboxFieldProps, SelectOption } from "@repo/ui/components/form";

import { useTRPC } from "@/lib/trpc/react";

export type UserPickerFieldProps<TValues extends FieldValues> = Omit<
  ComboboxFieldProps<TValues>,
  "options" | "onSearch" | "serverFiltered" | "loading"
>;

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 20;

const useDebounced = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
};

const toOption = (user: { id: string; name: string; email: string }): SelectOption => ({
  value: user.id,
  label: `${user.name} (${user.email})`,
});

/**
 * Searchable user select backed by `user.list` (server-side search, first 20 matches). Stores
 * the user id. The current value is fetched separately so its label shows even when it is not
 * among the search results.
 */
export const UserPickerField = <TValues extends FieldValues>(
  props: UserPickerFieldProps<TValues>,
) => {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  const value: unknown = useWatch({ control: props.control, name: props.name });
  const selectedId = typeof value === "string" && value !== "" ? value : null;

  const results = useQuery(
    trpc.user.list.queryOptions({
      page: 1,
      perPage: PAGE_SIZE,
      ...(search ? { search } : {}),
    }),
  );
  const inResults = results.data?.items.some((user) => user.id === selectedId) ?? false;
  const selected = useQuery({
    ...trpc.user.byId.queryOptions({ userId: selectedId ?? "" }),
    enabled: selectedId !== null && !inResults,
  });

  const options: SelectOption[] = [
    ...(selected.data && !inResults ? [toOption(selected.data)] : []),
    ...(results.data?.items.map(toOption) ?? []),
  ];

  return (
    <ComboboxField
      {...props}
      options={options}
      onSearch={setQuery}
      serverFiltered
      loading={results.isPending}
    />
  );
};
