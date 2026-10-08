import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type CommentTemplateOutputs = inferRouterOutputs<AppRouter>["commentTemplate"];

/** A row of `commentTemplate.list` (superjson keeps the dates); it carries the text as well. */
export type CommentTemplateRow = CommentTemplateOutputs["list"]["items"][number];
