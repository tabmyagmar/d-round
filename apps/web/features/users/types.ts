import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type UserOutputs = inferRouterOutputs<AppRouter>["user"];

/** A row of `user.list` (superjson keeps the dates). */
export type UserRow = UserOutputs["list"]["items"][number];
