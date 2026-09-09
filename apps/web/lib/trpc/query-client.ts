import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { deserialize, serialize } from "superjson";

export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Avoid immediate refetch on the client after SSR hydration.
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: deserialize,
      },
    },
  });

let browserQueryClient: QueryClient | undefined;

/** Server: a fresh client per request. Browser: one client for the whole session. */
export const getQueryClient = (): QueryClient => {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
};
