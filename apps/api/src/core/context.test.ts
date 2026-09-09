import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger } from "@repo/logger";

import { REQUEST_ID_HEADER, buildRequestContext } from "./context";
import type { ContextDeps } from "./context";

const deps = (): ContextDeps & { lines: string[] } => {
  const lines: string[] = [];
  const stream = new Writable({
    write: (chunk: Buffer | string, _encoding, callback) => {
      lines.push(chunk.toString());
      callback();
    },
  });
  return {
    lines,
    logger: createLogger({ name: "test" }, stream),
    // Context only carries these references; nothing here touches them.
    db: {} as ContextDeps["db"],
    redis: {} as ContextDeps["redis"],
  };
};

describe("buildRequestContext", () => {
  it("prefers the explicit request id, then the header, then generates one", () => {
    const d = deps();
    const headers = new Headers({ [REQUEST_ID_HEADER]: "from-header" });

    expect(buildRequestContext({ headers, requestId: "explicit" }, d).requestId).toBe("explicit");
    expect(buildRequestContext({ headers }, d).requestId).toBe("from-header");
    expect(buildRequestContext({ headers: new Headers() }, d).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("starts unauthenticated and binds the request id to the logger", () => {
    const d = deps();
    const ctx = buildRequestContext({ headers: new Headers(), requestId: "req-42" }, d);

    expect(ctx.user).toBeNull();
    expect(ctx.ability).toBeNull();
    ctx.logger.info("hello");
    expect(d.lines[0]).toContain('"requestId":"req-42"');
  });
});
