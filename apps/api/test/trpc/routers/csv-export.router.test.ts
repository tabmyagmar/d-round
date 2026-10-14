import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CSV_EXPORT_MAX_ROWS } from "@repo/validation";

import { createCallerFactory } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/router";
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
  return { user, caller: createCaller(ctx) };
};

describe("csvExport router", () => {
  it("is closed to a role without CSVダウンロード (catalog 1402)", async () => {
    const { user, caller } = await signedIn("am");

    await expect(caller.csvExport.list({ type: "STAFF" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.csvExport.create({ type: "STAFF", ids: [user.user.id], fields: ["email"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("answers BAD_REQUEST for too many rows or a column the type does not have", async () => {
    const { caller } = await signedIn("admin");
    const ids = Array.from({ length: CSV_EXPORT_MAX_ROWS + 1 }, () => crypto.randomUUID());

    await expect(
      caller.csvExport.create({ type: "STAFF", ids, fields: ["email"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.csvExport.create({
        type: "STAFF",
        ids: [crypto.randomUUID()],
        // @ts-expect-error -- the browser may send anything; the schema knows the columns
        fields: ["password"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("downloads one's own file again and answers NOT_FOUND for another's, which is recorded", async () => {
    const owner = await signedIn("admin");
    const other = await signedIn("admin");
    const csvExport = await owner.caller.csvExport.create({
      type: "USER",
      ids: [owner.user.user.id],
      fields: ["email"],
    });

    expect(await owner.caller.csvExport.downloadUrl({ csvExportId: csvExport.id })).toMatchObject({
      fileName: csvExport.fileName,
    });
    await expect(
      other.caller.csvExport.downloadUrl({ csvExportId: csvExport.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await h.db.auditLog.findMany({
        where: { action: "csvExport.downloadUrl", actorId: other.user.user.id },
      }),
    ).toEqual([expect.objectContaining({ status: "FAILURE", errorCode: "NOT_FOUND" })]);
  });
});
