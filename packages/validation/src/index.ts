// Single zod entry point for the whole monorepo (server and browser). Import `z` from
// "@repo/validation", never from "zod" directly, so the version is pinned in one place.
export { z } from "zod";
export type { ZodError, ZodType } from "zod";

export * from "./branch.schema";
export * from "./client.schema";
export * from "./comment-template.schema";
export * from "./common.schema";
export * from "./permission.schema";
export * from "./phone.schema";
export * from "./source.schema";
export * from "./staff.schema";
export * from "./user.schema";
