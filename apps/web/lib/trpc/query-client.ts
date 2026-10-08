import { MutationCache, QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { deserialize, serialize } from "superjson";

/**
 * A failed mutation's message, shown in one place as a toast — the legacy app's Apollo error link
 * did the same (`showError`) — instead of an alert inside each form. A mutation with its own
 * `onError` says something more specific and is left alone.
 */
const mutationCache = () =>
  new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (mutation.options.onError) {
        return;
      }
      toast.error("エラーが発生しました", { description: error.message });
    },
  });

export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    mutationCache: mutationCache(),

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
