import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { afterAll, describe, expect, it } from "vitest";

import {
  chunk,
  diffByKey,
  emptyToNull,
  parseFlag,
  parseInteger,
  readCsv,
} from "../../prisma/seed/support";

const dir = mkdtempSync(join(tmpdir(), "seed-support-"));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readCsv", () => {
  it("reads one object per row keyed by header, ignoring a BOM, CRLF and padding", () => {
    const file = join(dir, "regions.csv");
    writeFileSync(file, "\uFEFFcode,name\r\n1, 北海道 \r\n2,東北\r\n\r\n");

    expect(readCsv(pathToFileURL(file), ["code", "name"])).toEqual([
      { code: "1", name: "北海道" },
      { code: "2", name: "東北" },
    ]);
  });

  it("refuses a file whose header does not match the expected columns", () => {
    const file = join(dir, "renamed.csv");
    writeFileSync(file, "code,title\n1,北海道\n");

    expect(() => readCsv(pathToFileURL(file), ["code", "name"])).toThrow(/renamed\.csv.*code,name/);
  });

  it("reads a gzip-compressed file (*.gz) exactly like the plain file", () => {
    const content = "code,name\n1,北海道\n2,東北\n";
    const plain = join(dir, "addresses.csv");
    const compressed = join(dir, "addresses.csv.gz");
    writeFileSync(plain, content);
    writeFileSync(compressed, gzipSync(content));

    const rows = readCsv(pathToFileURL(compressed), ["code", "name"]);

    expect(rows).toEqual(readCsv(pathToFileURL(plain), ["code", "name"]));
    expect(rows).toEqual([
      { code: "1", name: "北海道" },
      { code: "2", name: "東北" },
    ]);
  });
});

describe("chunk", () => {
  it("splits items into consecutive slices of the given size, the last one shorter", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no slices for no items", () => {
    expect(chunk([], 1_000)).toEqual([]);
  });

  it.each([0, -1, 1.5, Number.NaN])("refuses size %s", (size) => {
    expect(() => chunk([1, 2, 3], size)).toThrow(/positive integer/);
  });
});

describe("parseInteger", () => {
  it("parses whole numbers", () => {
    expect(parseInteger("12", "code")).toBe(12);
    expect(parseInteger("-3", "code")).toBe(-3);
  });

  it.each(["", "1.5", "12a", "abc"])("rejects %j and names the column", (value) => {
    expect(() => parseInteger(value, "regionCode")).toThrow(/regionCode/);
  });
});

describe("parseFlag", () => {
  it("parses the legacy 0/1 flags", () => {
    expect(parseFlag("1", "hasChome")).toBe(true);
    expect(parseFlag("0", "hasChome")).toBe(false);
  });

  it.each(["", "2", "true", " 1"])("rejects %j and names the column", (value) => {
    expect(() => parseFlag(value, "hasChome")).toThrow(/hasChome/);
  });
});

describe("emptyToNull", () => {
  it("turns an empty cell into null and keeps any other value", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("x")).toBe("x");
  });
});

describe("diffByKey", () => {
  type Row = { code: number; name: string };
  const keyOf = (row: Row) => row.code;
  const isSame = (a: Row, b: Row) => a.name === b.name;

  it("returns missing rows to create and changed rows to update, leaving equal rows out", () => {
    const existing: Row[] = [
      { code: 1, name: "same" },
      { code: 2, name: "old" },
    ];
    const desired: Row[] = [
      { code: 1, name: "same" },
      { code: 2, name: "new" },
      { code: 3, name: "added" },
    ];

    expect(diffByKey(existing, desired, keyOf, isSame)).toEqual({
      toCreate: [{ code: 3, name: "added" }],
      toUpdate: [{ code: 2, name: "new" }],
    });
  });

  it("returns nothing to do when the data already matches", () => {
    const rows: Row[] = [{ code: 1, name: "same" }];

    expect(diffByKey(rows, rows, keyOf, isSame)).toEqual({ toCreate: [], toUpdate: [] });
  });

  it("refuses desired rows that repeat a key", () => {
    const desired: Row[] = [
      { code: 1, name: "first" },
      { code: 1, name: "second" },
    ];

    expect(() => diffByKey([], desired, keyOf, isSame)).toThrow(/duplicate key 1/);
  });
});
