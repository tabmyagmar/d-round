"use client";

import { useQuery } from "@tanstack/react-query";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { useTRPC } from "@/lib/trpc/react";

/**
 * The regions and prefectures (`source.regions`, `source.prefectures`): reference data that
 * changes with a seed only, so it is fetched once per session and kept. `enabled: false` waits
 * until a screen shows it.
 */
export const useSourceHierarchy = (enabled = true): SourceHierarchy => {
  const trpc = useTRPC();
  const regions = useQuery(
    trpc.source.regions.queryOptions(undefined, { enabled, staleTime: Infinity }),
  );
  const prefectures = useQuery(
    trpc.source.prefectures.queryOptions(undefined, { enabled, staleTime: Infinity }),
  );
  return {
    regions: regions.data ?? [],
    prefectures: prefectures.data ?? [],
    ready: regions.isSuccess && prefectures.isSuccess,
  };
};
