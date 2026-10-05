import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { diffByKey, parseInteger, readCsv } from "../../prisma/seed/support";

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
