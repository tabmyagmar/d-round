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

/** `user.chargerOptions`: a user the branch form may offer as 担当者. */
export type ChargerOption = inferRouterOutputs<AppRouter>["user"]["chargerOptions"][number];

/** A 担当者 as the branch form offers and names it: an option, or a stored 担当者's user. */
export type ChargerChoice = Pick<ChargerOption, "id" | "name">;

/** `client.options`: a client the branch form's クライアント名 offers (read from AppRouter). */
export type ClientOption = inferRouterOutputs<AppRouter>["client"]["options"][number];
