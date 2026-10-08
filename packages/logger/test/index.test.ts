import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { REDACT_CENSOR, childLogger, createDiscordAlertStream, createLogger } from "../src/index";

type Captured = { lines: () => Record<string, unknown>[]; stream: Writable };

const captureStream = (): Captured => {
  const chunks: string[] = [];
  const stream = new Writable({
    write: (chunk: Buffer | string, _encoding, callback) => {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
};

describe("createLogger", () => {
  it("redacts secrets at any depth", () => {
    const captured = captureStream();
    const logger = createLogger({ name: "test" }, captured.stream);

    logger.info(
      {
        password: "hunter2",
        token: "abc",
        user: { password: "nested", token: "t" },
        req: { headers: { authorization: "Bearer x", cookie: "session=1", accept: "*/*" } },
      },
      "login",
    );

    const [line] = captured.lines();
    expect(line).toBeDefined();
    expect(line?.["password"]).toBe(REDACT_CENSOR);
    expect(line?.["token"]).toBe(REDACT_CENSOR);
    expect(line?.["user"]).toEqual({ password: REDACT_CENSOR, token: REDACT_CENSOR });
    expect(line?.["req"]).toEqual({
      headers: { authorization: REDACT_CENSOR, cookie: REDACT_CENSOR, accept: "*/*" },
    });
    expect(line?.["msg"]).toBe("login");
    expect(line?.["name"]).toBe("test");
  });

  it("respects the configured level", () => {
    const captured = captureStream();
    const logger = createLogger({ name: "test", level: "warn" }, captured.stream);

    logger.info("dropped");
    logger.warn("kept");

    expect(captured.lines().map((line) => line["msg"])).toEqual(["kept"]);
  });

  it("uses ISO timestamps", () => {
    const captured = captureStream();
    createLogger({ name: "test" }, captured.stream).info("tick");

    const [line] = captured.lines();
    expect(typeof line?.["time"]).toBe("string");
    expect(Number.isNaN(Date.parse(line?.["time"] as string))).toBe(false);
  });
});

describe("childLogger", () => {
  it("adds bindings to every line and keeps redaction", () => {
    const captured = captureStream();
    const logger = createLogger({ name: "test" }, captured.stream);
    const child = childLogger(logger, { requestId: "req-1" });

    child.info({ password: "x" }, "child line");

    const [line] = captured.lines();
    expect(line?.["requestId"]).toBe("req-1");
    expect(line?.["password"]).toBe(REDACT_CENSOR);
  });
});

describe("createLogger with alerts", () => {
  /** A fake Discord webhook: the only external provider involved. */
  const fakeDiscord = () => {
    const bodies: string[] = [];
    const alerts = createDiscordAlertStream({
      webhookUrl: "https://discord.test/api/webhooks/1/secret",
      fetch: (_url, init) => {
        bodies.push(init?.body as string);
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    return { alerts, bodies };
  };

  it("keeps every line on the destination and also sends the error lines", async () => {
    const captured = captureStream();
    const { alerts, bodies } = fakeDiscord();
    const logger = createLogger({ name: "test", level: "debug", alerts }, captured.stream);

    logger.debug("debug line");
    logger.warn("warn line");
    logger.error({ err: new Error("boom") }, "error line");
    await alerts.flush();

    expect(captured.lines().map((line) => line["msg"])).toEqual([
      "debug line",
      "warn line",
      "error line",
    ]);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain("error line");
  });

  it("never sends a secret logged next to an error", async () => {
    const { alerts, bodies } = fakeDiscord();
    const logger = createLogger({ name: "test", alerts }, captureStream().stream);

    logger.error(
      {
        err: new Error("boom"),
        password: "hunter2",
        user: { token: "tok-123" },
        req: { headers: { cookie: "session=abc" } },
      },
      "sign-in failed",
    );
    await alerts.flush();

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain("hunter2");
    expect(bodies[0]).not.toContain("tok-123");
    expect(bodies[0]).not.toContain("session=abc");
  });
});
