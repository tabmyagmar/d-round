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
      on: (event: string, handler: (...args: unknown[]) => void) => emitter.on(event, handler),
      off: (event: string, handler: (...args: unknown[]) => void) => emitter.off(event, handler),
      exit,
    } as unknown as NodeJS.Process,
  };
};

/** A real logger whose lines the test reads back. */
const capturedLogger = () => {
  const lines: { level: number; msg: string }[] = [];
  const logger = createLogger(
    { name: "test" },
    new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        lines.push(JSON.parse(chunk.toString()) as { level: number; msg: string });
        callback();
      },
    }),
  );
  return { logger, lines };
};

describe("registerGracefulShutdown", () => {
  it.each([
    ["uncaughtException", "uncaught exception"],
    ["unhandledRejection", "unhandled rejection"],
  ])("logs %s as fatal, runs the steps and exits 1", async (event, message) => {
    const { emitter, exit, proc } = fakeProcess();
    const { logger, lines } = capturedLogger();
    const order: string[] = [];

    registerGracefulShutdown({
      logger,
      process: proc,
      steps: [{ name: "http server", run: () => order.push("http server") }],
    });
    emitter.emit(event, new Error("boom"));

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(order).toEqual(["http server"]);
    expect(lines).toContainEqual(expect.objectContaining({ level: 60, msg: message }));
  });

  it("logs a missed deadline as fatal before it forces the exit", async () => {
    const { exit, proc } = fakeProcess();
    const { logger, lines } = capturedLogger();

    const shutdown = registerGracefulShutdown({
      logger,
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

  it("exits 1 when a crash happens while a shutdown is already running", async () => {
    const { emitter, exit, proc } = fakeProcess();
    const { logger } = capturedLogger();
    let release: () => void = () => undefined;

    registerGracefulShutdown({
      logger,
      process: proc,
      steps: [
        {
          name: "http server",
          run: () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        },
      ],
    });
    emitter.emit("SIGTERM");
    emitter.emit("unhandledRejection", new Error("closing client failed"));
    release();

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
  });
});
