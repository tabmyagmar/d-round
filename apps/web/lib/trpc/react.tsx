"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import superjson from "superjson";

import type { AppRouter } from "@repo/api/router";

import { publicEnv } from "@/lib/env";

import { getQueryClient } from "./query-client";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

const createClient = () =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${publicEnv.apiUrl}/trpc`,
        transformer: superjson,
        // Cookies (Better Auth session) must travel with every request. tRPC's init
        // type allows `signal: undefined`, which exactOptionalPropertyTypes rejects for fetch.
        fetch: (input, init) => fetch(input, { ...init, credentials: "include" } as RequestInit),
      }),
    ],
  });

export const TRPCReactProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(createClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
};
