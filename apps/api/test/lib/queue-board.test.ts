import { Writable } from "node:stream";

import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { createLogger } from "@repo/logger";
import { QUEUE_NAMES, createRedisConnection, waitForRedis } from "@repo/queue";

import { createApp } from "../../src/app";
import type { App } from "../../src/app";
import { createQueueBoard } from "../../src/lib/queue-board";
import { contextDeps, createHarness, signedInUser } from "../support";
import type { SignedInUser, TestHarness } from "../support";

/** The bull-board dashboard at /queues: super_admin only, read-only (docs/adr/0014-queue-dashboard.md). */
let h: TestHarness;
let app: App;
let superAdmin: SignedInUser;
let admin: SignedInUser;

beforeAll(async () => {
  h = await createHarness();
  app = createApp(contextDeps(h));
  [superAdmin, admin] = await Promise.all([
    signedInUser(h, { role: "super_admin" }),
    signedInUser(h, { role: "admin" }),
  ]);
});

afterAll(async () => {
  await h.stop();
});

type BoardQueues = { queues: { name: string; readOnlyMode: boolean }[] };

describe("/queues as super_admin", () => {
  it("serves the dashboard page and the assets it loads", async () => {
    const page = await app.request("/queues", { headers: superAdmin.headers });

    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const script = /src="(static\/js\/main\.[^"]+\.js)"/.exec(await page.text())?.[1];
    expect(script).toBeDefined();

    const asset = await app.request(`/queues/${script ?? ""}`, { headers: superAdmin.headers });
    expect(asset.status).toBe(200);

    const head = await app.request("/queues", { method: "HEAD", headers: superAdmin.headers });
    expect(head.status).toBe(200);
  });

  it("lists every queue, each read-only", async () => {
    const response = await app.request("/queues/api/queues", { headers: superAdmin.headers });

    expect(response.status).toBe(200);
    const { queues } = (await response.json()) as BoardQueues;
    expect(queues.map((queue) => queue.name).toSorted()).toEqual(
      Object.values(QUEUE_NAMES).toSorted(),
    );
    expect(queues.every((queue) => queue.readOnlyMode)).toBe(true);
  });

  it("shows the job options the producers enqueue with", async () => {
    for (const name of [QUEUE_NAMES.attachmentDelete, QUEUE_NAMES.csvImport]) {
      const response = await app.request(`/queues/api/queues/${name}/default-job-options`, {
        headers: superAdmin.headers,
      });
      expect(await response.json(), name).toMatchObject({ removeOnFail: true });
    }
  });

  it("refuses every write with 405", async () => {
    for (const [method, path] of [
      ["PUT", "/queues/api/queues/email/retry/failed"],
      ["PUT", "/queues/api/queues/pause"],
      ["POST", "/queues/api/queues/email/add"],
    ] as const) {
      const response = await app.request(path, { method, headers: superAdmin.headers });
      expect(response.status, `${method} ${path}`).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
    }
  });

  it("logs a Redis error of its queues through the logger, not the console", async () => {
    const lines: string[] = [];
    const logger = createLogger(
      { name: "test", level: "debug" },
      new Writable({
        write: (chunk: Buffer, _encoding, callback) => {
          lines.push(chunk.toString());
          callback();
        },
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const redis = createRedisConnection(inject("redisUrl"), { connectionName: "queue-board-test" });

    try {
      await waitForRedis(redis);
      createQueueBoard({ ...contextDeps(h), redis, logger });

      redis.emit("error", new Error("redis down"));

      expect(consoleError).not.toHaveBeenCalled();
      expect(lines.filter((line) => line.includes("redis down"))).toHaveLength(
        Object.values(QUEUE_NAMES).length,
      );
    } finally {
      consoleError.mockRestore();
      await redis.quit();
    }
  });
});

describe("/queues for everyone else", () => {
  it.each([
    ["no session", () => new Headers()],
    ["an admin", () => admin.headers],
  ])("answers 404 to %s, on the page, its assets and its API", async (_who, headers) => {
    for (const path of ["/queues", "/queues/static/js/missing.js", "/queues/api/queues"]) {
      const response = await app.request(path, { headers: headers() });
      expect(response.status, path).toBe(404);
      expect(await response.json()).toMatchObject({ error: "Not found" });
    }
  });

  it.each([
    ["no session", () => new Headers()],
    ["an admin", () => admin.headers],
  ])("answers 404, not 405, to a write from %s", async (_who, headers) => {
    const response = await app.request("/queues/api/queues/pause", {
      method: "PUT",
      headers: headers(),
    });

    expect(response.status).toBe(404);
  });
});
