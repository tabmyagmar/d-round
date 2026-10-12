// `@repo/api/jobs` — the only part of the API apps/worker may import (.claude/rules/layers.md,
// docs/adr/0013-csv-import.md): the runners of jobs whose rules live in API services, the context
// they need, and Better Auth as the API builds it. The worker still owns every queue consumer.
export type { ContextDeps as JobDeps } from "../core/context";
export { createAppAuth } from "./app-auth";
export type { AppAuthOptions } from "./app-auth";
