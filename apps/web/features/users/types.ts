import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type UserOutputs = inferRouterOutputs<AppRouter>["user"];

/** A row of `user.list` (superjson keeps the dates). */
export type UserRow = UserOutputs["list"]["items"][number];

/** `user.byId`: the user and their effective permission keys. */
export type UserDetail = UserOutputs["byId"];

/** `permission.catalog`: visible groups (menu parents) with their child permissions and roles. */
export type PermissionCatalog = inferRouterOutputs<AppRouter>["permission"]["catalog"];
