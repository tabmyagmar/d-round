import { describe, expect, it } from "vitest";

import { checkHealth } from "./health.service";

describe("checkHealth", () => {
  it("reports ok when every probe resolves", async () => {
    const report = await checkHealth({
      database: () => Promise.resolve(1),
      redis: () => Promise.resolve("PONG"),
    });

    expect(report.status).toBe("ok");
    expect(report.checks).toEqual({ database: "ok", redis: "ok" });
    expect(report.errors).toEqual({});
    expect(Number.isNaN(Date.parse(report.checkedAt))).toBe(false);
  });

  it("reports degraded with the failing probe's reason and keeps the others ok", async () => {
    const report = await checkHealth({
      database: () => Promise.reject(new Error("connection refused")),
      redis: () => Promise.resolve("PONG"),
    });

    expect(report.status).toBe("degraded");
    expect(report.checks).toEqual({ database: "error", redis: "ok" });
    expect(report.errors).toEqual({ database: "connection refused" });
  });

  it("treats a hanging probe as an error after the timeout", async () => {
    const report = await checkHealth(
      { redis: () => new Promise(() => undefined) },
      { timeoutMs: 20 },
    );

    expect(report.status).toBe("degraded");
    expect(report.errors["redis"]).toContain("timed out after 20ms");
  });
});
