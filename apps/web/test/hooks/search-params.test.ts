import { describe, expect, it } from "vitest";

import { z } from "@repo/validation";

import {
  pageToParam,
  parseSearchParams,
  sortingFromParams,
  sortingToParams,
  withParams,
} from "@/hooks/search-params";

const params = (query: string) => new URLSearchParams(query);

describe("withParams", () => {
  it("sets a value and keeps the other parameters", () => {
    expect(withParams(params("role=admin"), { search: "amy" }).toString()).toBe(
      "role=admin&search=amy",
    );
  });

  it("removes a parameter set to null, undefined or an empty string", () => {
    const next = withParams(params("a=1&b=2&c=3&d=4"), { a: null, b: undefined, c: "" });

    expect(next.toString()).toBe("d=4");
  });

  it("goes back to the first page when a filter changes", () => {
    expect(withParams(params("page=3&role=admin"), { role: "am" }).toString()).toBe("role=am");
  });

  it("keeps the page when only paging or ordering changes", () => {
    expect(withParams(params("page=3"), { sortBy: "name", sortOrder: "asc" }).toString()).toBe(
      "page=3&sortBy=name&sortOrder=asc",
    );
    expect(withParams(params("page=3&perPage=20"), { page: 4 }).toString()).toBe(
      "page=4&perPage=20",
    );
  });

  it("writes an array as repeated parameters and an empty array as none", () => {
    expect(withParams(params("area=x"), { area: ["east", "west"] }).toString()).toBe(
      "area=east&area=west",
    );
    expect(withParams(params("area=x&b=1"), { area: [] }).toString()).toBe("b=1");
  });

  it("never changes the parameters it was given", () => {
    const original = params("page=2&role=admin");

    withParams(original, { role: null });

    expect(original.toString()).toBe("page=2&role=admin");
  });
});

describe("sortingFromParams / sortingToParams", () => {
  it("reads one sorted column from sortBy and sortOrder", () => {
    expect(sortingFromParams(params("sortBy=name&sortOrder=asc"))).toEqual([
      { id: "name", desc: false },
    ]);
    expect(sortingFromParams(params("sortBy=email&sortOrder=desc"))).toEqual([
      { id: "email", desc: true },
    ]);
  });

  it("reads no sorting when sortBy is missing, and ascending when only the order is missing", () => {
    expect(sortingFromParams(params("sortOrder=asc"))).toEqual([]);
    expect(sortingFromParams(params("sortBy=name"))).toEqual([{ id: "name", desc: false }]);
  });

  it("writes the first sorted column back, or clears both parameters", () => {
    expect(sortingToParams([{ id: "name", desc: true }])).toEqual({
      sortBy: "name",
      sortOrder: "desc",
    });
    expect(sortingToParams([])).toEqual({ sortBy: null, sortOrder: null });
  });
});

describe("pageToParam", () => {
  it("leaves the first page out of the URL and writes the others", () => {
    expect(pageToParam(1)).toBeNull();
    expect(pageToParam(2)).toBe(2);
  });
});

describe("parseSearchParams", () => {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().trim().min(1).optional(),
    role: z.enum(["admin", "am"]).optional(),
  });

  it("keeps each valid parameter, parsed by its own field schema", () => {
    expect(parseSearchParams(schema, params("page=2&search=%20amy%20&role=admin"))).toEqual({
      page: 2,
      search: "amy",
      role: "admin",
    });
  });

  it("drops an invalid parameter without losing the valid ones", () => {
    expect(parseSearchParams(schema, params("page=zero&role=root&search=amy"))).toEqual({
      search: "amy",
    });
  });

  it("leaves absent parameters out, so the schema's defaults apply where it is parsed", () => {
    expect(parseSearchParams(schema, params("unrelated=1"))).toEqual({});
  });

  const listSchema = z.object({
    areas: z.array(z.enum(["EAST", "WEST"])).optional(),
    regionCodes: z.array(z.coerce.number().int().min(1)).optional(),
  });

  it("reads a repeated parameter as a list, each item through the element schema", () => {
    expect(
      parseSearchParams(listSchema, params("areas=WEST&areas=EAST&regionCodes=4&regionCodes=7")),
    ).toEqual({ areas: ["WEST", "EAST"], regionCodes: [4, 7] });
    expect(parseSearchParams(listSchema, params("regionCodes=9"))).toEqual({ regionCodes: [9] });
  });

  it("drops invalid list items and leaves a list with none out", () => {
    expect(
      parseSearchParams(
        listSchema,
        params("areas=NORTH&regionCodes=4&regionCodes=x&regionCodes=0"),
      ),
    ).toEqual({ regionCodes: [4] });
    expect(parseSearchParams(listSchema, params(""))).toEqual({});
  });
});
