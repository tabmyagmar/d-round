import { EventEmitter } from "node:events";
import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { createLogger } from "@repo/logger";

import { registerGracefulShutdown } from "../../src/lib/graceful-shutdown";

const fakeProcess = () => {
  const emitter = new EventEmitter();
  const exit = vi.fn();
  return {
    emitter,
    exit,
    proc: {
      on: (signal: string, handler: () => void) => emitter.on(signal, handler),
      off: (signal: string, handler: () => void) => emitter.off(signal, handler),
      exit,
    } as unknown as NodeJS.Process,
  };
};

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() };

/** A real logger whose lines the test reads back. */
const capturedLogger = () => {
  const lines: { level: number; msg: string }[] = [];
  const captured = createLogger(
    { name: "test" },
    new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        lines.push(JSON.parse(chunk.toString()) as { level: number; msg: string });
        callback();
      },
    }),
  );
  return { logger: captured, lines };
};

describe("registerGracefulShutdown", () => {
  it("runs steps in order on SIGTERM and exits 0", async () => {
    const { emitter, exit, proc } = fakeProcess();
    const order: string[] = [];

    registerGracefulShutdown({
      logger,
      process: proc,
      steps: [
        { name: "workers", run: () => order.push("workers") },
        { name: "redis", run: async () => void order.push("redis") },
      ],
    });

    emitter.emit("SIGTERM");
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(0);
    });
    expect(order).toEqual(["workers", "redis"]);
  });

  it("runs only once even if several signals arrive", async () => {
    const { emitter, exit, proc } = fakeProcess();
    const run = vi.fn();

    registerGracefulShutdown({ logger, process: proc, steps: [{ name: "once", run }] });

    emitter.emit("SIGTERM");
    emitter.emit("SIGINT");
    emitter.emit("SIGTERM");
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledTimes(1);
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("continues past a failing step and exits 1", async () => {
    const { exit, proc } = fakeProcess();
    const second = vi.fn();

    const shutdown = registerGracefulShutdown({
      logger,
      process: proc,
      steps: [
        {
          name: "broken",
          run: () => {
            throw new Error("nope");
          },
        },
        { name: "second", run: second },
      ],
    });

    await shutdown("test");
    expect(second).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("forces exit when steps exceed the deadline, with a fatal line", async () => {
    const { exit, proc } = fakeProcess();
    const { logger: captured, lines } = capturedLogger();

    const shutdown = registerGracefulShutdown({
      logger: captured,
      process: proc,
      timeoutMs: 20,
      steps: [{ name: "hangs", run: () => new Promise(() => undefined) }],
    });

    void shutdown("test");
    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(lines).toContainEqual(
      expect.objectContaining({ level: 60, msg: "shutdown timed out, forcing exit" }),
    );
  });

  it.each([
    ["uncaughtException", "uncaught exception"],
    ["unhandledRejection", "unhandled rejection"],
  ])("logs %s as fatal, runs the steps and exits 1", async (event, message) => {
    const { emitter, exit, proc } = fakeProcess();
    const { logger: captured, lines } = capturedLogger();
    const order: string[] = [];

    registerGracefulShutdown({
      logger: captured,
      process: proc,
      steps: [{ name: "workers", run: () => order.push("workers") }],
    });
    emitter.emit(event, new Error("boom"));

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(order).toEqual(["workers"]);
    expect(lines).toContainEqual(expect.objectContaining({ level: 60, msg: message }));
  });

  it("exits with the code the caller gives when every step succeeds", async () => {
    const { exit, proc } = fakeProcess();

    const shutdown = registerGracefulShutdown({ logger, process: proc, steps: [] });

    await shutdown("startup failure", 1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
