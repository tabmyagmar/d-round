"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/react";

/** The catalog changes with a seed, not per request: cache it for the session's screens. */
const CATALOG_STALE_MS = 5 * 60_000;

/** `permission.catalog` (needs `changeRole User`); pass `enabled: false` when it is not shown. */
export const usePermissionCatalog = (enabled = true) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.permission.catalog.queryOptions(undefined, { enabled, staleTime: CATALOG_STALE_MS }),
  );
};
