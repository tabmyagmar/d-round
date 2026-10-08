import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type ClientOutputs = inferRouterOutputs<AppRouter>["client"];

/** A row of `client.list`: the client, its address with the master's parts and its 担当者. */
export type ClientRow = ClientOutputs["list"]["items"][number];

/** `client.byId`: the client with its address, regions by name and 担当者. */
export type ClientDetail = ClientOutputs["byId"];

/** `user.chargerOptions`: a user the client form may offer as 担当者. */
export type ChargerOption = inferRouterOutputs<AppRouter>["user"]["chargerOptions"][number];
