import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
import { startImport, userCsv, userLine } from "../../modules/csv-import/user-csv";
import { contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

/** The router only wires input → ability → service; these tests prove the wiring and codes. */
let h: TestHarness;
const createCaller = createCallerFactory(appRouter);

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const signedIn = async (role: "admin" | "am") => {
  const user = await signedInUser(h, { role });
  const ctx = await contextFor(h, user.headers);
  return { ctx, caller: createCaller(ctx) };
};

describe("csvImport router", () => {
  it("is closed to a role without the CSV grants (catalog 1401 / 1402)", async () => {
    const { caller } = await signedIn("am");

    await expect(caller.csvImport.list({ type: "USER_CREATE" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.csvImport.create({ type: "USER_CREATE", attachmentId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reads one's own import and answers NOT_FOUND for another's", async () => {
    const owner = await signedIn("admin");
    const other = await signedIn("admin");
    const csvImport = await startImport(h, owner.ctx, userCsv(userLine().text));

    expect(await owner.caller.csvImport.byId({ csvImportId: csvImport.id })).toMatchObject({
      id: csvImport.id,
      status: "UPLOADED",
    });
    expect(await owner.caller.csvImport.rows({ csvImportId: csvImport.id })).toEqual([]);
    await expect(other.caller.csvImport.byId({ csvImportId: csvImport.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("answers BAD_REQUEST for lines that are not row numbers or repeat", async () => {
    const { caller } = await signedIn("admin");

    for (const lineNumbers of [[], [1], [2, 2]]) {
      await expect(
        caller.csvImport.confirm({ csvImportId: crypto.randomUUID(), lineNumbers }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});
