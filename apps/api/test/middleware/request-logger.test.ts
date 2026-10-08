import { Writable } from "node:stream";

import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { describe, expect, it } from "vitest";

import { createDiscordAlertStream, createLogger } from "@repo/logger";

import { requestLogger } from "../../src/middleware/request-logger";
import type { AppVariables } from "../../src/middleware/request-logger";

/** The access log of a tiny app, read back, with a fake Discord behind the alerts. */
const setup = () => {
  const written: string[] = [];
  const bodies: string[] = [];
  const alerts = createDiscordAlertStream({
    webhookUrl: "https://discord.test/api/webhooks/1/secret",
    fetch: (_url, init) => {
      bodies.push(init?.body as string);
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  const logger = createLogger(
    { name: "api", alerts },
    new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        written.push(chunk.toString());
        callback();
      },
    }),
  );
  const app = new Hono<{ Variables: AppVariables }>();
  app.use(requestId());
  app.use(requestLogger(logger));
  app.get("/api/auth/reset-password/:token", (c) => c.text("database down", 500));
  app.get("/health", (c) => c.text("ok"));
  return { app, alerts, written, bodies };
};

describe("requestLogger", () => {
  it("never writes the token of a mailed password link, not even when the request fails", async () => {
    const { app, alerts, written, bodies } = setup();

    const response = await app.request(
      "/api/auth/reset-password/tok-SECRET-123?callbackURL=%2Fnew-password",
    );
    await alerts.flush();

    expect(response.status).toBe(500);
    expect(written.join("")).toContain('"path":"/api/auth/reset-password/[Redacted]"');
    expect(written.join("")).not.toContain("tok-SECRET-123");
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain("tok-SECRET-123");
  });

  it("logs every other path as it is", async () => {
    const { app, written } = setup();

    await app.request("/health");

    expect(written.join("")).toContain('"path":"/health"');
  });
});
