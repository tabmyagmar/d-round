import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type StaffOutputs = inferRouterOutputs<AppRouter>["staff"];

/** A row of `staff.list`: the staff, its regions by name and its current 担当者. */
export type StaffRow = StaffOutputs["list"]["items"][number];

/** `staff.byId`: the staff with its address, regions, prefectures, 担当者 history and lists. */
export type StaffDetail = StaffOutputs["byId"];

/** A row of `staff.byCharger`: a staff a user is in charge of, with its regions. */
export type ChargedStaff = StaffOutputs["byCharger"][number];

/** `user.chargerOptions`: a user who may be a staff's 担当者 (covers one of its regions). */
export type ChargerOption = inferRouterOutputs<AppRouter>["user"]["chargerOptions"][number];

/** A 定型文 the memo fields offer as a shortcut (`commentTemplate.list` for STAFF). */
export type MemoTemplate = Pick<
  inferRouterOutputs<AppRouter>["commentTemplate"]["list"]["items"][number],
  "id" | "short" | "content"
>;
