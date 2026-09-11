import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

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

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

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

  it("forces exit when steps exceed the deadline", async () => {
    const { exit, proc } = fakeProcess();

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
  });
});
