import { describe, expect, it } from "vitest";

import { PAGINATION_MAX_PER_PAGE, idSchema, paginationSchema } from "../src/common.schema";

describe("paginationSchema", () => {
  it("defaults page and perPage", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 });
  });

  it("coerces query-string numbers", () => {
    expect(paginationSchema.parse({ page: "3", perPage: "50" })).toEqual({ page: 3, perPage: 50 });
  });

  it("rejects perPage above the hard maximum", () => {
    expect(paginationSchema.safeParse({ perPage: PAGINATION_MAX_PER_PAGE + 1 }).success).toBe(
      false,
    );
  });
});

describe("idSchema", () => {
  it("accepts UUID v7 and rejects garbage", () => {
    expect(idSchema.safeParse("019187d5-0d76-7d1a-9a4c-4f7d2a1f3b6e").success).toBe(true);
    expect(idSchema.safeParse("42").success).toBe(false);
  });
});
