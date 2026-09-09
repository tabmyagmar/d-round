import { Writable } from "node:stream";

import { deserialize } from "superjson";
import type { SuperJSONResult } from "superjson";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createPrismaClient } from "@repo/database";
import type { PrismaClient } from "@repo/database";
import { createLogger } from "@repo/logger";
import { createRedisConnection, waitForRedis } from "@repo/queue";
import type { RedisConnection } from "@repo/queue";

import { createApp } from "../src/app";
import type { App } from "../src/app";
import { REQUEST_ID_HEADER } from "../src/core/context";

/** End-to-end over the real HTTP surface with real Postgres and Redis behind it. */
let db: PrismaClient;
let redis: RedisConnection;
let app: App;

const silentLogger = () =>
  createLogger(
    { name: "test", level: "silent" },
    new Writable({
      write: (_chunk, _encoding, callback) => {
        callback();
      },
    }),
  );

beforeAll(async () => {
  db = createPrismaClient({ connectionString: inject("databaseUrl") });
  redis = createRedisConnection(inject("redisUrl"));
  await waitForRedis(redis);
  app = createApp({ logger: silentLogger(), db, redis, webOrigin: "http://localhost:3000" });
});

afterAll(async () => {
  await Promise.all([db.$disconnect(), redis.quit()]);
});

describe("GET /health", () => {
  it("returns 200 with both dependencies ok", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; checks: Record<string, string> };
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ database: "ok", redis: "ok" });
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/\S+/);
  });

  it("returns 503 when a dependency is down", async () => {
    const degraded = createApp({
      logger: silentLogger(),
      db,
      redis,
      webOrigin: "http://localhost:3000",
      probes: { database: () => Promise.reject(new Error("down")), redis: () => redis.ping() },
    });

    const response = await degraded.request("/health");

    expect(response.status).toBe(503);
    expect(((await response.json()) as { status: string }).status).toBe("degraded");
  });
});

describe("tRPC over HTTP", () => {
  it("serves health.ping with superjson and echoes the request id", async () => {
    const response = await app.request("/trpc/health.ping", {
      headers: { [REQUEST_ID_HEADER]: "req-e2e" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-e2e");

    const envelope = (await response.json()) as { result: { data: SuperJSONResult } };
    const data = deserialize<{ ok: boolean; requestId: string; time: Date }>(envelope.result.data);
    expect(data.ok).toBe(true);
    expect(data.requestId).toBe("req-e2e");
    expect(data.time).toBeInstanceOf(Date);
  });

  it("answers CORS preflight for the configured web origin only", async () => {
    const allowed = await app.request("/trpc/health.ping", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "GET" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");

    const denied = await app.request("/trpc/health.ping", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 with the request id", async () => {
    const response = await app.request("/nope", { headers: { [REQUEST_ID_HEADER]: "req-404" } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found", requestId: "req-404" });
  });
});
