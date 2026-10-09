import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withTransaction } from "@repo/database";
import { attachmentDeleteJobId } from "@repo/queue";
import type { AttachmentDeleteQueue } from "@repo/queue";
import { createUploadUrlSchema } from "@repo/validation";
import type { AttachmentKind } from "@repo/validation";

import type { RequestContext } from "../../../src/core/context";
import { ForbiddenError, ValidationError } from "../../../src/core/errors";
import {
  PENDING_UPLOADS_MAX,
  UPLOADS_TOO_MANY,
  UPLOAD_EXPIRED,
  UPLOAD_INCOMPLETE,
  UPLOAD_NOT_ALLOWED,
  assertUploaded,
  createUploadUrl,
  syncAttachments,
  viewsOf,
} from "../../../src/modules/attachment/attachment.service";
import type { AttachmentTarget } from "../../../src/modules/attachment/attachment.service";
import { contextFor, createHarness, signedInUser, uniqueEmployeeNumber } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

const contextOf = async (role: "admin" | "am" = "am") => {
  const signedIn = await signedInUser(h, { role });
  return { id: signedIn.user.id, ctx: await contextFor(h, signedIn.headers) };
};

const FILES: Record<AttachmentKind, { fileName: string; contentType: string }> = {
  USER_AVATAR: { fileName: "顔写真.PNG", contentType: "image/png" },
  STAFF_RESUME: { fileName: "履歴書.pdf", contentType: "application/pdf" },
};

/** An upload URL as the router would hand it out, and (unless `upload: false`) the PUT done. */
const uploaded = async (ctx: RequestContext, kind: AttachmentKind, { upload = true } = {}) => {
  const target = await createUploadUrl(
    ctx,
    createUploadUrlSchema.parse({ kind, size: 2048, ...FILES[kind] }),
  );
  const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
  if (upload) {
    h.storage.put(row.objectKey, { size: row.size, contentType: row.contentType });
  }
  return row;
};

const createStaff = () =>
  h.db.staff.create({
    data: {
      employeeType: "FULL_TIME",
      employeeNumber: uniqueEmployeeNumber(),
      lastName: "添付",
      firstName: "花子",
      lastNameKana: "テンプ",
      firstNameKana: "ハナコ",
      gender: "FEMALE",
    },
  });

const storedStatus = async (id: string) =>
  (await h.db.attachment.findUniqueOrThrow({ where: { id } })).status;

const deleteJobOf = (attachmentId: string) =>
  h.attachmentDeleteQueue.getJob(attachmentDeleteJobId(attachmentId));

describe("createUploadUrl", () => {
  it("creates a PENDING row and a signed PUT for the kind's folder", async () => {
    const me = await contextOf();
    const before = Date.now();

    const target = await createUploadUrl(
      me.ctx,
      createUploadUrlSchema.parse({ kind: "USER_AVATAR", size: 2048, ...FILES.USER_AVATAR }),
    );

    const row = await h.db.attachment.findUniqueOrThrow({ where: { id: target.id } });
    expect(row).toMatchObject({
      kind: "USER_AVATAR",
      status: "PENDING",
      fileName: "顔写真.png",
      contentType: "image/png",
      size: 2048,
      uploadedById: me.id,
      userId: null,
    });
    expect(row.objectKey).toMatch(/^avatars\/[0-9a-f-]{36}\.png$/);
    expect(target.url).toBe(`memory://upload/${row.objectKey}`);
    expect(target.headers).toEqual({
      "Content-Type": "image/png",
      "x-goog-content-length-range": "2048,2048",
    });
    expect(target.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60_000);
  });

  it("lets only someone who may write a staff upload a 履歴書", async () => {
    const am = await contextOf("am");
    const admin = await contextOf("admin");
    const input = createUploadUrlSchema.parse({
      kind: "STAFF_RESUME",
      size: 10,
      ...FILES.STAFF_RESUME,
    });

    await expect(createUploadUrl(am.ctx, input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createUploadUrl(admin.ctx, input)).resolves.toMatchObject({
      url: expect.stringMatching(/^memory:\/\/upload\/resumes\//) as unknown,
    });
  });
});

describe("assertUploaded", () => {
  it("passes the uploader's finished uploads and the owner's own files", async () => {
    const admin = await contextOf("admin");
    const staff = await createStaff();
    const kept = await uploaded(admin.ctx, "STAFF_RESUME");
    await withTransaction(h.db, (txc) =>
      syncAttachments(admin.ctx, txc, {
        kind: "STAFF_RESUME",
        owner: { staffId: staff.id },
        ids: [kept.id],
      }),
    );
    const fresh = await uploaded(admin.ctx, "STAFF_RESUME");

    await expect(
      assertUploaded(admin.ctx, "STAFF_RESUME", [kept.id, fresh.id], { staffId: staff.id }),
    ).resolves.toBeUndefined();
    await expect(assertUploaded(admin.ctx, "STAFF_RESUME", [])).resolves.toBeUndefined();
  });

  it("refuses an upload that never reached the bucket, expired, or is someone else's", async () => {
    const me = await contextOf();
    const other = await contextOf();
    const notPut = await uploaded(me.ctx, "USER_AVATAR", { upload: false });
    const foreign = await uploaded(other.ctx, "USER_AVATAR");
    const expired = await uploaded(me.ctx, "USER_AVATAR");
    await h.db.attachment.update({ where: { id: expired.id }, data: { status: "DELETED" } });
    const othersAvatar = await uploaded(other.ctx, "USER_AVATAR");
    await withTransaction(h.db, (txc) =>
      syncAttachments(other.ctx, txc, {
        kind: "USER_AVATAR",
        owner: { userId: other.id },
        ids: [othersAvatar.id],
      }),
    );

    const refusal = (ids: string[]) =>
      assertUploaded(me.ctx, "USER_AVATAR", ids, { userId: me.id }).then(
        () => "passed",
        (error: unknown) => (error instanceof ValidationError ? error.message : "other error"),
      );

    expect(await refusal([notPut.id])).toBe(UPLOAD_INCOMPLETE);
    expect(await refusal([foreign.id])).toBe(UPLOAD_NOT_ALLOWED);
    expect(await refusal([expired.id])).toBe(UPLOAD_EXPIRED);
    expect(await refusal([crypto.randomUUID()])).toBe(UPLOAD_EXPIRED);
    expect(await refusal([othersAvatar.id])).toBe(UPLOAD_NOT_ALLOWED);
    // Another kind's upload, on a create (no owner yet).
    await expect(assertUploaded(me.ctx, "STAFF_RESUME", [notPut.id])).rejects.toThrow(
      new ValidationError(UPLOAD_NOT_ALLOWED),
    );
    // One avatar per user; an id twice is not two files.
    const second = await uploaded(me.ctx, "USER_AVATAR");
    const third = await uploaded(me.ctx, "USER_AVATAR");
    expect(await refusal([second.id, third.id])).toBe(UPLOAD_NOT_ALLOWED);
    expect(await refusal([second.id, second.id])).toBe(UPLOAD_NOT_ALLOWED);
  });
});

describe("syncAttachments", () => {
  it("attaches new files, keeps the current ones and deletes the dropped ones after commit", async () => {
    const admin = await contextOf("admin");
    const staff = await createStaff();
    const owner = { staffId: staff.id };
    const first = await uploaded(admin.ctx, "STAFF_RESUME");
    const second = await uploaded(admin.ctx, "STAFF_RESUME");
    await withTransaction(h.db, (txc) =>
      syncAttachments(admin.ctx, txc, { kind: "STAFF_RESUME", owner, ids: [first.id, second.id] }),
    );
    const third = await uploaded(admin.ctx, "STAFF_RESUME");

    await withTransaction(h.db, (txc) =>
      syncAttachments(admin.ctx, txc, { kind: "STAFF_RESUME", owner, ids: [first.id, third.id] }),
    );

    const rows = await h.db.attachment.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
    });
    const statusOf = (id: string) => rows.find((row) => row.id === id)?.status;
    expect([statusOf(first.id), statusOf(second.id), statusOf(third.id)]).toEqual([
      "ATTACHED",
      "DELETED",
      "ATTACHED",
    ]);
    expect(rows.find((row) => row.id === third.id)?.staffId).toBe(staff.id);
    expect((await deleteJobOf(second.id))?.data).toEqual({
      attachmentId: second.id,
      traceId: admin.ctx.requestId,
    });
    expect(await deleteJobOf(first.id)).toBeUndefined();
  });

  it("enqueues nothing when the owner's write rolls back", async () => {
    const me = await contextOf();
    const owner = { userId: me.id };
    const old = await uploaded(me.ctx, "USER_AVATAR");
    await withTransaction(h.db, (txc) =>
      syncAttachments(me.ctx, txc, { kind: "USER_AVATAR", owner, ids: [old.id] }),
    );
    const replacement = await uploaded(me.ctx, "USER_AVATAR");

    await expect(
      withTransaction(h.db, async (txc) => {
        await syncAttachments(me.ctx, txc, { kind: "USER_AVATAR", owner, ids: [replacement.id] });
        throw new Error("the owner's write failed");
      }),
    ).rejects.toThrow("the owner's write failed");

    expect((await h.db.attachment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
      "ATTACHED",
    );
    expect(await deleteJobOf(old.id)).toBeUndefined();
  });

  it("fails the write when the sweeper expired a pending file in between", async () => {
    const me = await contextOf();
    const pending = await uploaded(me.ctx, "USER_AVATAR");
    await h.db.attachment.update({ where: { id: pending.id }, data: { status: "DELETED" } });

    await expect(
      withTransaction(h.db, (txc) =>
        syncAttachments(me.ctx, txc, {
          kind: "USER_AVATAR",
          owner: { userId: me.id },
          ids: [pending.id],
        }),
      ),
    ).rejects.toThrow(UPLOAD_EXPIRED);
  });
});

describe("viewsOf", () => {
  it("lists the owner's files with read URLs that name the file", async () => {
    const me = await contextOf();
    const avatar = await uploaded(me.ctx, "USER_AVATAR");
    await withTransaction(h.db, (txc) =>
      syncAttachments(me.ctx, txc, {
        kind: "USER_AVATAR",
        owner: { userId: me.id },
        ids: [avatar.id],
      }),
    );

    expect(await viewsOf(me.ctx, { kind: "USER_AVATAR", owner: { userId: me.id } })).toEqual([
      {
        id: avatar.id,
        fileName: "顔写真.png",
        contentType: "image/png",
        size: 2048,
        url: `memory://read/${avatar.objectKey}?filename=${encodeURIComponent("顔写真.png")}`,
      },
    ]);
  });
});

describe("guards around the attach", () => {
  it("refuses a kind with another kind's owner, whatever the caller's types said", async () => {
    const admin = await contextOf("admin");
    const staff = await createStaff();
    const avatar = await uploaded(admin.ctx, "USER_AVATAR");
    const mismatched = {
      kind: "USER_AVATAR",
      owner: { staffId: staff.id },
      ids: [avatar.id],
    } as unknown as AttachmentTarget & { ids: string[] };

    await expect(
      withTransaction(h.db, (txc) => syncAttachments(admin.ctx, txc, mismatched)),
    ).rejects.toThrow(/belongs to its userId owner/);
    await expect(viewsOf(admin.ctx, mismatched)).rejects.toThrow(/belongs to its userId owner/);
    expect(await storedStatus(avatar.id)).toBe("PENDING");
  });

  it("lets two saves of one owner take turns, so one avatar stays attached", async () => {
    const me = await contextOf();
    const owner = { userId: me.id };
    const first = await uploaded(me.ctx, "USER_AVATAR");
    const second = await uploaded(me.ctx, "USER_AVATAR");

    await Promise.all(
      [first, second].map((avatar) =>
        withTransaction(h.db, (txc) =>
          syncAttachments(me.ctx, txc, { kind: "USER_AVATAR", owner, ids: [avatar.id] }),
        ),
      ),
    );

    const attached = await h.db.attachment.count({
      where: { userId: me.id, kind: "USER_AVATAR", status: "ATTACHED" },
    });
    expect(attached).toBe(1);
  });

  it("keeps a committed save when the delete cannot be enqueued; the sweeper takes over", async () => {
    const me = await contextOf();
    const owner = { userId: me.id };
    const old = await uploaded(me.ctx, "USER_AVATAR");
    await withTransaction(h.db, (txc) =>
      syncAttachments(me.ctx, txc, { kind: "USER_AVATAR", owner, ids: [old.id] }),
    );
    const replacement = await uploaded(me.ctx, "USER_AVATAR");
    const redisDown = {
      ...me.ctx,
      attachmentDeleteQueue: {
        add: () => Promise.reject(new Error("redis down")),
      } as unknown as AttachmentDeleteQueue,
    };

    await withTransaction(h.db, (txc) =>
      syncAttachments(redisDown, txc, { kind: "USER_AVATAR", owner, ids: [replacement.id] }),
    );

    expect(await storedStatus(old.id)).toBe("DELETED");
    expect(await storedStatus(replacement.id)).toBe("ATTACHED");
  });

  it("stops handing out upload URLs once a user holds too many unattached uploads", async () => {
    const me = await contextOf();
    await h.db.attachment.createMany({
      data: Array.from({ length: PENDING_UPLOADS_MAX }, () => ({
        kind: "USER_AVATAR" as const,
        objectKey: `avatars/${crypto.randomUUID()}.png`,
        fileName: "face.png",
        contentType: "image/png",
        size: 10,
        uploadedById: me.id,
      })),
    });

    await expect(uploaded(me.ctx, "USER_AVATAR")).rejects.toThrow(
      new ValidationError(UPLOADS_TOO_MANY),
    );
  });
});
