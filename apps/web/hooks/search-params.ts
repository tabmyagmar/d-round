import type { DataTableSortingState } from "@repo/ui/components/composed/data-table";
import { z } from "@repo/validation";

/**
 * URL query helpers for list pages: filters, paging and sorting live in the URL so a link
 * reproduces the view and back/forward works. Pure functions; the hooks in this folder wrap them.
 */

export type SearchParamValue =
  string | number | boolean | readonly (string | number)[] | null | undefined;

/** Paging and ordering. Changing any other parameter is a filter change and returns to page 1. */
export const NON_RESET_KEYS: readonly string[] = ["page", "perPage", "sortBy", "sortOrder"];

const isEmpty = (value: SearchParamValue): boolean =>
  value === null || value === undefined || value === "";

/**
 * A copy of `params` with `changes` applied: an empty value (`null`, `undefined`, `""`, `[]`)
 * removes the parameter, an array writes it repeated. A change to a filter drops `page`.
 */
export const withParams = (
  params: URLSearchParams,
  changes: Readonly<Record<string, SearchParamValue>>,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  for (const [name, value] of Object.entries(changes)) {
    if (Array.isArray(value)) {
      next.delete(name);
      for (const item of value as readonly (string | number)[]) {
        next.append(name, String(item));
      }
    } else if (isEmpty(value)) {
      next.delete(name);
    } else {
      // `set` replaces in place, so an existing parameter keeps its position in the URL.
      next.set(name, String(value));
    }
  }
  if (Object.keys(changes).some((name) => !NON_RESET_KEYS.includes(name))) {
    next.delete("page");
  }
  return next;
};

/** The `page` parameter for a page number: page 1 is the default and stays out of the URL. */
export const pageToParam = (page: number): number | null => (page > 1 ? page : null);

/** The table's sorting from `sortBy` / `sortOrder` (ascending unless `sortOrder=desc`). */
export const sortingFromParams = (params: URLSearchParams): DataTableSortingState => {
  const sortBy = params.get("sortBy");
  return sortBy ? [{ id: sortBy, desc: params.get("sortOrder") === "desc" }] : [];
};

/** The `sortBy` / `sortOrder` changes for a new table sorting (first column only). */
export const sortingToParams = (
  sorting: DataTableSortingState,
): { sortBy: string | null; sortOrder: "asc" | "desc" | null } => {
  const [first] = sorting;
  return first
    ? { sortBy: first.id, sortOrder: first.desc ? "desc" : "asc" }
    : { sortBy: null, sortOrder: null };
};

/** The array schema inside an optional or defaulted list field (`areas`), or `null`. */
const arrayOf = (field: z.ZodType): z.ZodArray | null => {
  if (field instanceof z.ZodArray) {
    return field;
  }
  if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
    return arrayOf(field.unwrap() as z.ZodType);
  }
  return null;
};

/** A list parameter (`?areas=EAST&areas=WEST`): each valid item kept, none at all left out. */
const parseList = (field: z.ZodType, array: z.ZodArray, raw: readonly string[]): unknown[] => {
  const items = raw.flatMap((item) => {
    const parsed = (array.element as z.ZodType).safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  if (items.length === 0) {
    return [];
  }
  const parsed = field.safeParse(items);
  return parsed.success ? [parsed.data] : [];
};

/**
 * Reads the parameters a list schema knows, each through its own field schema: a valid value is
 * kept (coerced, trimmed), an invalid or absent one is left out so the schema's default applies
 * where the input is parsed (the API). An array field reads its repeated parameter and keeps the
 * valid items. A hand-edited URL never breaks the page.
 */
export const parseSearchParams = <TSchema extends z.ZodObject>(
  schema: TSchema,
  params: URLSearchParams,
): Partial<z.output<TSchema>> => {
  const entries = Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(
    ([name, field]) => {
      const array = arrayOf(field);
      if (array) {
        return parseList(field, array, params.getAll(name)).map((value) => [name, value] as const);
      }
      const raw = params.get(name);
      if (raw === null) {
        return [];
      }
      const parsed = field.safeParse(raw);
      return parsed.success ? [[name, parsed.data] as const] : [];
    },
  );
  return Object.fromEntries(entries) as Partial<z.output<TSchema>>;
};
