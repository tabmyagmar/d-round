import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { attachmentDeleteJobId } from "@repo/queue";
import { createUploadUrlSchema, updateStaffSchema } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { ValidationError } from "../../../src/core/errors";
import {
  UPLOAD_INCOMPLETE,
  createUploadUrl,
} from "../../../src/modules/attachment/attachment.service";
import * as staffService from "../../../src/modules/staff/staff.service";
import {
  contextFor,
  createHarness,
  ensureTestPostCode,
  signedInUser,
  staffInput,
} from "../../support";
import type { TestHarness } from "../../support";

/** 履歴書 on the staff writes and reads (ADR 0012). */
let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
  await ensureTestPostCode(h);
});

afterAll(async () => {
  await h.stop();
});

/** An admin's context (every Admin_Staff row) and a 担当者 to assign. */
const adminWithCharger = async () => {
  const admin = await signedInUser(h, { role: "admin" });
  const charger = await signedInUser(h, { name: "担当 一郎", profile: {} });
  return { ctx: await contextFor(h, admin.headers), chargerId: charger.user.id };
};

/** A 履歴書 upload of the caller: the URL handed out and (unless `put: false`) the PUT done. */
const uploadedResume = async (ctx: RequestContext, fileName: string, { put = true } = {}) => {
  const target = await createUploadUrl(
    ctx,
    createUploadUrlSchema.parse({
      kind: "STAFF_RESUME",
      fileName,
      contentType: "application/pdf",
      size: 1024,
    }),
  );
  const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
  if (put) {
    h.storage.put(row.objectKey, { size: row.size, contentType: row.contentType });
  }
  return row;
};

const statusOf = async (id: string) =>
  (await h.db.attachment.findUniqueOrThrow({ where: { id } })).status;

describe("the 履歴書 on スタッフ追加 / 編集 and the detail", () => {
  it("attaches the files on create and lists them, with read URLs, on the detail", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const first = await uploadedResume(ctx, "履歴書1.pdf");
    const second = await uploadedResume(ctx, "履歴書2.pdf");

    const created = await staffService.create(
      ctx,
      staffInput([chargerId], { resumeIds: [first.id, second.id] }),
    );

    expect(created.resumes.map((file) => file.fileName)).toEqual(["履歴書1.pdf", "履歴書2.pdf"]);
    const detail = await staffService.getById(ctx, created.id);
    expect(detail.resumes.map((file) => file.id)).toEqual([first.id, second.id]);
    expect(detail.resumes[0]?.url).toContain(first.objectKey);
  });

  it("replaces the set on update: kept files stay, dropped ones go to the worker", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const kept = await uploadedResume(ctx, "kept.pdf");
    const dropped = await uploadedResume(ctx, "dropped.pdf");
    const created = await staffService.create(
      ctx,
      staffInput([chargerId], { resumeIds: [kept.id, dropped.id] }),
    );
    const added = await uploadedResume(ctx, "added.pdf");

    const updated = await staffService.update(
      ctx,
      updateStaffSchema.parse({
        ...staffInput([chargerId], { employeeNumber: created.employeeNumber }),
        staffId: created.id,
        resumeIds: [kept.id, added.id],
      }),
    );

    expect(updated.resumes.map((file) => file.fileName)).toEqual(["kept.pdf", "added.pdf"]);
    expect(await statusOf(dropped.id)).toBe("DELETED");
    expect(await h.attachmentDeleteQueue.getJob(attachmentDeleteJobId(dropped.id))).toBeDefined();
  });

  it("leaves the files alone when the input has no resumeIds", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const resume = await uploadedResume(ctx, "stays.pdf");
    const created = await staffService.create(
      ctx,
      staffInput([chargerId], { resumeIds: [resume.id] }),
    );

    const updated = await staffService.update(ctx, {
      ...staffInput([chargerId], { employeeNumber: created.employeeNumber }),
      staffId: created.id,
    });

    expect(updated.resumes.map((file) => file.id)).toEqual([resume.id]);
  });

  it("refuses a file whose upload never finished, and writes nothing", async () => {
    const { ctx, chargerId } = await adminWithCharger();
    const unfinished = await uploadedResume(ctx, "unfinished.pdf", { put: false });
    const input = staffInput([chargerId], { resumeIds: [unfinished.id] });

    await expect(staffService.create(ctx, input)).rejects.toThrow(
      new ValidationError(UPLOAD_INCOMPLETE),
    );
    expect(await h.db.staff.count({ where: { employeeNumber: input.employeeNumber } })).toBe(0);
    expect(await statusOf(unfinished.id)).toBe("PENDING");
  });
});
