"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { withParams } from "@/hooks/search-params";
import type { SearchParamValue } from "@/hooks/search-params";

/**
 * The current query string and setters that navigate to the same page with new parameters
 * (`withParams`: empty values removed, a filter change returns to page 1). History entries are
 * pushed, so back/forward walks through the filters; the scroll position is kept.
 */
export const useSearch = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setMany = useCallback(
    (changes: Readonly<Record<string, SearchParamValue>>) => {
      const query = withParams(searchParams, changes).toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const set = useCallback(
    (name: string, value: SearchParamValue) => {
      setMany({ [name]: value });
    },
    [setMany],
  );

  return { searchParams, set, setMany };
};
