import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import type { Auth } from "@repo/auth";
import { QUEUE_NAMES, createQueue } from "@repo/queue";
import type { RedisConnection } from "@repo/queue";

import type { AppVariables } from "../middleware/request-logger";

/** Where the dashboard is mounted; bull-board builds its asset and API URLs from it. */
export const QUEUE_BOARD_PATH = "/queues";

export type QueueBoardDeps = {
  auth: Auth;
  redis: RedisConnection;
};

/**
 * The bull-board dashboard (docs/adr/0014-queue-dashboard.md): one read-only view per queue in
 * QUEUE_NAMES, for super_admin only. The browser opens it directly, so the gate reads the Better
 * Auth session cookie; anyone else gets the app's 404. Writes are refused with 405 even for
 * super_admin: the DB row is the truth and manual retry is `resetToPending` (.claude/rules/queue.md).
 * The queues share the API's Redis connection, which the graceful shutdown quits.
 */
export const createQueueBoard = (deps: QueueBoardDeps): Hono<{ Variables: AppVariables }> => {
  const serverAdapter = new HonoAdapter(serveStatic).setBasePath(QUEUE_BOARD_PATH);
  createBullBoard({
    queues: Object.values(QUEUE_NAMES).map(
      (name) => new BullMQAdapter(createQueue(name, deps.redis), { readOnlyMode: true }),
    ),
    serverAdapter,
  });

  const board = new Hono<{ Variables: AppVariables }>();
  board.use(async (c, next) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user.role !== "super_admin") {
      return c.notFound();
    }
    if (c.req.method !== "GET") {
      return c.json({ error: "Method not allowed", requestId: c.get("requestId") }, 405);
    }
    return next();
  });
  board.route("/", serverAdapter.registerPlugin());
  return board;
};
