import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";

type StaffOutputs = inferRouterOutputs<AppRouter>["staff"];

/** A row of `staff.list`: the staff, its regions by name and its current 担当者. */
export type StaffRow = StaffOutputs["list"]["items"][number];
