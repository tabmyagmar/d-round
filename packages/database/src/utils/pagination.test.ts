import { describe, expect, it } from "vitest";

import { buildPage, normalizePage, toSkipTake } from "./pagination";

describe("normalizePage", () => {
  it("applies defaults for missing or invalid values", () => {
    expect(normalizePage({})).toEqual({ page: 1, perPage: 20 });
    expect(normalizePage({ page: 0, perPage: -5 })).toEqual({ page: 1, perPage: 20 });
    expect(normalizePage({ page: Number.NaN, perPage: Number.POSITIVE_INFINITY })).toEqual({
      page: 1,
      perPage: 20,
    });
  });

  it("clamps perPage to the maximum and floors fractions", () => {
    expect(normalizePage({ page: 2.9, perPage: 500 })).toEqual({ page: 2, perPage: 100 });
    expect(normalizePage({ perPage: 30 }, { maxPerPage: 25 })).toEqual({ page: 1, perPage: 25 });
  });
});

describe("toSkipTake", () => {
  it("translates 1-based pages to offsets", () => {
    expect(toSkipTake({ page: 1, perPage: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toSkipTake({ page: 3, perPage: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe("buildPage", () => {
  it("computes navigation metadata", () => {
    const page = buildPage(["a", "b"], 45, { page: 2, perPage: 20 });
    expect(page).toMatchObject({ total: 45, totalPages: 3, hasNext: true, hasPrev: true });
    expect(buildPage([], 0, { page: 1, perPage: 20 })).toMatchObject({
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    expect(buildPage(["x"], 1, { page: 1, perPage: 20 })).toMatchObject({
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });
});
