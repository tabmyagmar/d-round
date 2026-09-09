# processors/

One file per queue: `<queue>.processor.ts` exporting `create<Queue>Worker(deps)` built with
`createWorker` from `@repo/queue`. Register it in `src/index.ts`.

Rules (see `.claude/rules/queue.md`): ID-only payloads, re-read the row from the database,
no-op when the work is already done, throw `UnrecoverableError` for permanent failures.
