import { describe, expect, it } from "vitest";

import { assertNotProduction } from "../../prisma/seed/support";

describe("assertNotProduction", () => {
  it("refuses to run in production and points to the production-safe seed", () => {
    expect(() => {
      assertNotProduction({ NODE_ENV: "production" });
    }).toThrow(/db:seed:reference/);
  });

  it("allows development", () => {
    expect(() => {
      assertNotProduction({ NODE_ENV: "development" });
    }).not.toThrow();
  });

  it("allows an environment without NODE_ENV", () => {
    expect(() => {
      assertNotProduction({});
    }).not.toThrow();
  });
});
