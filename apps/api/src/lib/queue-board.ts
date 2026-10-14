import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import {
  QUEUE_NAMES,
  createAttachmentDeleteQueue,
  createCsvImportQueue,
  createEmailQueue,
  createQueue,
} from "@repo/queue";

import { buildRequestContext } from "../core/context";
import type { ContextDeps } from "../core/context";
import type { AppVariables } from "../middleware/request-logger";

/** Where the dashboard is mounted; bull-board builds its asset and API URLs from it. */
export const QUEUE_BOARD_PATH = "/queues";

/**
 * The bull-board dashboard (docs/adr/0014-queue-dashboard.md): one read-only view per queue, for
 * super_admin only (.claude/rules/permissions.md). The browser opens it directly, so the gate reads
 * the session cookie; anyone else gets the app's 404. Writes are refused with 405 even for
 * super_admin: the DB row is the truth and manual retry is `resetToPending` (.claude/rules/queue.md).
 */
export const createQueueBoard = (deps: ContextDeps): Hono<{ Variables: AppVariables }> => {
  // The producers' factories, so the board shows the job options the jobs are enqueued with; the
  // sweepers' queues take the defaults, as in apps/worker. The test checks this list against
  // QUEUE_NAMES.
  const queues = [
    createEmailQueue(deps.redis),
    createAttachmentDeleteQueue(deps.redis),
    createCsvImportQueue(deps.redis),
    createQueue(QUEUE_NAMES.outboxSweeper, deps.redis),
    createQueue(QUEUE_NAMES.attachmentSweeper, deps.redis),
    createQueue(QUEUE_NAMES.csvImportSweeper, deps.redis),
    createQueue(QUEUE_NAMES.auditLogSweeper, deps.redis),
  ];
  // They share the API's Redis connection: index.ts logs its errors and the shutdown quits it.
  // Without a listener BullMQ would print each error once more per queue to the console.
  for (const queue of queues) {
    queue.on("error", (error) => {
      deps.logger.debug({ err: error, queue: queue.name }, "queue board: redis error");
    });
  }

  const serverAdapter = new HonoAdapter(serveStatic).setBasePath(QUEUE_BOARD_PATH);
  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue, { readOnlyMode: true })),
    serverAdapter,
  });

  const board = new Hono<{ Variables: AppVariables }>();
  board.use(async (c, next) => {
    const ctx = await buildRequestContext(
      { headers: c.req.raw.headers, requestId: c.get("requestId") },
      deps,
    );
    if (ctx.user?.role !== "super_admin") {
      return c.notFound();
    }
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      c.header("Allow", "GET, HEAD");
      return c.json({ error: "Method not allowed", requestId: ctx.requestId }, 405);
    }
    return next();
  });
  board.route("/", serverAdapter.registerPlugin());
  return board;
};
