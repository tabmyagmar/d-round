import { deserialize } from "superjson";
import type { SuperJSONResult } from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import type { App } from "../src/app";
import { REQUEST_ID_HEADER } from "../src/core/context";

import { TEST_WEB_ORIGIN, createHarness } from "./support";
import type { TestHarness } from "./support";

/** End-to-end over the real HTTP surface with real Postgres and Redis behind it. */
let h: TestHarness;
let app: App;

beforeAll(async () => {
  h = await createHarness();
  app = createApp({
    logger: h.logger,
    db: h.db,
    redis: h.redis,
    auth: h.auth,
    webOrigin: TEST_WEB_ORIGIN,
  });
});

afterAll(async () => {
  await h.stop();
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
      logger: h.logger,
      db: h.db,
      redis: h.redis,
      auth: h.auth,
      webOrigin: TEST_WEB_ORIGIN,
      probes: { database: () => Promise.reject(new Error("down")), redis: () => h.redis.ping() },
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
      headers: { origin: TEST_WEB_ORIGIN, "access-control-request-method": "GET" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(TEST_WEB_ORIGIN);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");

    const denied = await app.request("/trpc/health.ping", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns UNAUTHORIZED for protected procedures without a session", async () => {
    const response = await app.request("/trpc/user.me");
    expect(response.status).toBe(401);
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 with the request id", async () => {
    const response = await app.request("/nope", { headers: { [REQUEST_ID_HEADER]: "req-404" } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found", requestId: "req-404" });
  });
});
