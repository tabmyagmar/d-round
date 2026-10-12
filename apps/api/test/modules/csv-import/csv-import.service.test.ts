import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { csvCheckJobId, csvImportJobId } from "@repo/queue";
import { createUploadUrlSchema } from "@repo/validation";

import { ConflictError, ForbiddenError, NotFoundError } from "../../../src/core/errors";
import {
  UPLOAD_INCOMPLETE,
  createUploadUrl,
} from "../../../src/modules/attachment/attachment.service";
import { runCsvCheck, runCsvImport } from "../../../src/modules/csv-import/csv-import.runner";
import * as csvImportService from "../../../src/modules/csv-import/csv-import.service";
import {
  CSV_LINES_NOT_IMPORTABLE,
  CSV_NOT_CONFIRMABLE,
  CSV_ROW_NOT_PROCESSED,
} from "../../../src/modules/csv-import/csv-import.service";
import { contextDeps, contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

import { startImport } from "./csv-flow";
import { userCsv, userLine } from "./user-csv";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const contextOf = async (role: "admin" | "manager" | "am" = "admin") => {
  const signedIn = await signedInUser(h, { role });
  return { signedIn, ctx: await contextFor(h, signedIn.headers) };
};

const check = (csvImportId: string) =>
  runCsvCheck(contextDeps(h), { csvImportId, lastAttempt: true });

describe("csvImport.create", () => {
  it("starts the import of an uploaded file and enqueues its check after commit", async () => {
    const { ctx } = await contextOf();

    const csvImport = await startImport(h, ctx, userCsv(userLine().text));

    expect(csvImport).toMatchObject({
      status: "UPLOADED",
      type: "USER_CREATE",
      fileName: "取込.csv",
    });
    expect(await h.db.attachment.findFirst({ where: { csvImportId: csvImport.id } })).toMatchObject(
      {
        kind: "CSV_IMPORT",
        status: "ATTACHED",
      },
    );
    const job = await h.csvImportQueue.getJob(csvCheckJobId(csvImport.id));
    expect(job?.data).toEqual({ csvImportId: csvImport.id, traceId: ctx.requestId });
  });

  it("refuses an uploader without the entity's grant and a file not uploaded", async () => {
    const manager = await contextOf("manager");
    const admin = await contextOf("admin");

    await expect(startImport(h, manager.ctx, userCsv(userLine().text))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const target = await createUploadUrl(
      admin.ctx,
      createUploadUrlSchema.parse({
        kind: "CSV_IMPORT",
        fileName: "担当者.csv",
        contentType: "text/csv",
        size: 10,
      }),
    );
    await expect(
      csvImportService.create(admin.ctx, { type: "USER_CREATE", attachmentId: target.id }),
    ).rejects.toThrow(UPLOAD_INCOMPLETE);
  });
});

describe("csvImport.confirm", () => {
  it("confirms rows without errors, enqueues the import after commit and only once", async () => {
    const { ctx } = await contextOf();
    const csvImport = await startImport(
      h,
      ctx,
      userCsv(userLine().text, userLine({ lastNameKana: "やまだ" }).text),
    );
    await check(csvImport.id);

    await expect(
      csvImportService.confirm(ctx, { csvImportId: csvImport.id, lineNumbers: [2, 3] }),
    ).rejects.toThrow(CSV_LINES_NOT_IMPORTABLE);
    expect((await csvImportService.byId(ctx, csvImport.id)).status).toBe("CHECKED");
    expect((await csvImportService.rows(ctx, csvImport.id)).map((row) => row.selected)).toEqual([
      false,
      false,
    ]);

    const confirmed = await csvImportService.confirm(ctx, {
      csvImportId: csvImport.id,
      lineNumbers: [2],
    });
    expect(confirmed).toMatchObject({ status: "CONFIRMED", selectedCount: 1 });
    expect(await h.csvImportQueue.getJob(csvImportJobId(csvImport.id))).toBeDefined();

    const again = csvImportService.confirm(ctx, { csvImportId: csvImport.id, lineNumbers: [2] });
    await expect(again).rejects.toBeInstanceOf(ConflictError);
    await expect(again).rejects.toThrow(CSV_NOT_CONFIRMABLE);
  });

  it("refuses an import still being checked", async () => {
    const { ctx } = await contextOf();
    const csvImport = await startImport(h, ctx, userCsv(userLine().text));

    await expect(
      csvImportService.confirm(ctx, { csvImportId: csvImport.id, lineNumbers: [2] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("reading imports", () => {
  it("keeps every import its uploader's, whatever their role", async () => {
    const owner = await contextOf("admin");
    const other = await contextOf("admin");
    const csvImport = await startImport(h, owner.ctx, userCsv(userLine().text));

    for (const read of [csvImportService.byId, csvImportService.rows, csvImportService.errorCsv]) {
      await expect(read(other.ctx, csvImport.id)).rejects.toBeInstanceOf(NotFoundError);
    }
    await expect(
      csvImportService.confirm(other.ctx, { csvImportId: csvImport.id, lineNumbers: [2] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const page = await csvImportService.list(other.ctx, {
      type: "USER_CREATE",
      page: 1,
      perPage: 20,
    });
    expect(page.items.map((item) => item.id)).not.toContain(csvImport.id);
  });

  it("pages one type's imports newest first, with the uploader", async () => {
    const { signedIn, ctx } = await contextOf();
    const older = await startImport(h, ctx, userCsv(userLine().text));
    const newer = await startImport(h, ctx, userCsv(userLine().text));
    await startImport(h, ctx, userCsv(userLine().text), "USER_UPDATE");

    const page = await csvImportService.list(ctx, { type: "USER_CREATE", page: 1, perPage: 20 });

    expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(page.items[0]?.createdBy.email).toBe(signedIn.email);
  });
});

describe("csvImport.errorCsv", () => {
  it("writes the rows to fix — check errors, refused rows, rows left undone — as a CSV Excel opens", async () => {
    const { ctx } = await contextOf();
    const fine = userLine();
    const taken = userLine();
    const invalid = userLine({ lastNameKana: "やまだ" });
    const csvImport = await startImport(h, ctx, userCsv(fine.text, taken.text, invalid.text));
    await check(csvImport.id);
    await csvImportService.confirm(ctx, { csvImportId: csvImport.id, lineNumbers: [2, 3] });
    await h.auth.api.createUser({ body: { email: taken.email, name: "先客", role: "am" } });
    await runCsvImport(contextDeps(h), { csvImportId: csvImport.id, lastAttempt: true });

    const { fileName, text } = await csvImportService.errorCsv(ctx, csvImport.id);

    expect(fileName).toBe("取込_エラー.csv");
    const [header, ...lines] = text
      .replace(/^\uFEFF/u, "")
      .trimEnd()
      .split("\r\n");
    expect(header).toMatch(/^"社員番号（必須）","姓（必須）",.*,"退職日","行番号","エラー内容"$/u);
    expect(lines).toEqual([
      expect.stringMatching(
        new RegExp(
          `^"${taken.employeeNumber}",.*"3","既に登録されているため、登録できませんでした"$`,
          "u",
        ),
      ),
      expect.stringMatching(
        new RegExp(
          `^"${invalid.employeeNumber}",.*"4","セイ: 全角カタカナで入力してください"$`,
          "u",
        ),
      ),
    ]);
    expect(CSV_ROW_NOT_PROCESSED).toMatch(/中断/u);
  });
});
