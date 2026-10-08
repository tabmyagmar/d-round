import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type BranchOutputs = inferRouterOutputs<AppRouter>["branch"];

/**
 * A row of `branch.list`: the branch with its 部署 and 連絡担当者, its client, region, address and
 * 担当者 — the same read as `branch.byId`, so a row also fills the detail dialog.
 */
export type BranchRow = BranchOutputs["list"]["items"][number];

/** `branch.byId`. */
export type BranchDetail = BranchOutputs["byId"];
