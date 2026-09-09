import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { REDACT_CENSOR, childLogger, createLogger } from "./index";

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
