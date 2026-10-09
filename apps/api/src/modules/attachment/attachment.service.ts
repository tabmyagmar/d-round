import { createAttachmentRepository } from "@repo/database";
import type { Attachment, AttachmentOwner, TransactionContext } from "@repo/database";
import { enqueueAttachmentDeleteJob } from "@repo/queue";
import { ATTACHMENT_RULES, ATTACHMENT_URL_TTL_SECONDS, fileExtension } from "@repo/validation";
import type { AttachmentKind, CreateUploadUrlInput } from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, ValidationError } from "../../core/errors";

/**
 * Attachments (docs/adr/0012-attachments.md). The browser asks for an upload URL and writes the
 * file straight to the bucket; the owner's write attaches it with the two guards below, the first
 * before and the second inside its transaction; the owner's read hands out read URLs (`viewsOf`).
 * Objects are deleted by the worker, after commit.
 */

export type UploadTarget = {
  id: string;
  url: string;
  /** Sent verbatim with the PUT: the signature covers them. */
  headers: Record<string, string>;
  expiresAt: Date;
};

/** A file as the screens show it; `url` is a signed read URL (ATTACHMENT_URL_TTL_SECONDS). */
export type AttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
};

export const UPLOAD_EXPIRED = "ファイルの有効期限が切れました。もう一度選択してください";
export const UPLOAD_INCOMPLETE =
  "ファイルのアップロードが完了していません。もう一度選択してください";
export const UPLOAD_NOT_ALLOWED = "このファイルは添付できません";

const uploaderOf = (ctx: RequestContext) => {
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  return ctx.user;
};

const isOwnedBy = (row: Attachment, owner: AttachmentOwner): boolean =>
  "userId" in owner ? row.userId === owner.userId : row.staffId === owner.staffId;

/**
 * A 履歴書 is picked on the staff form only, by someone who may create or update a staff. Who may
 * set a プロフィール画像 is the user write's decision (their own, or `update User`).
 */
const assertMayUpload = (ctx: RequestContext, kind: AttachmentKind): void => {
  if (
    kind === "STAFF_RESUME" &&
    !ctx.ability.can("create", "Staff") &&
    !ctx.ability.can("update", "Staff")
  ) {
    throw new ForbiddenError("Not allowed to upload staff files");
  }
};

/** A PENDING row and a signed PUT for it; the row expires after 24 h unless an owner attaches it. */
export const createUploadUrl = async (
  ctx: RequestContext,
  input: CreateUploadUrlInput,
): Promise<UploadTarget> => {
  const uploader = uploaderOf(ctx);
  assertMayUpload(ctx, input.kind);
  const folder = ATTACHMENT_RULES[input.kind].folder;
  const row = await createAttachmentRepository(ctx.db).create({
    kind: input.kind,
    objectKey: `${folder}/${crypto.randomUUID()}${fileExtension(input.fileName)}`,
    fileName: input.fileName,
    contentType: input.contentType,
    size: input.size,
    uploadedById: uploader.id,
  });
  const upload = await ctx.storage.createUploadUrl({
    key: row.objectKey,
    contentType: row.contentType,
    size: row.size,
    expiresInSeconds: ATTACHMENT_URL_TTL_SECONDS,
  });
  return { id: row.id, ...upload };
};

/**
 * Before the owner's transaction (bucket calls stay out of it): `ids` fit the kind's limit, and
 * every id the owner does not have yet is a PENDING upload of this user and kind whose object is
 * in the bucket. `owner` is undefined on a create.
 */
export const assertUploaded = async (
  ctx: RequestContext,
  kind: AttachmentKind,
  ids: readonly string[],
  owner?: AttachmentOwner,
): Promise<void> => {
  const uploader = uploaderOf(ctx);
  if (new Set(ids).size !== ids.length || ids.length > ATTACHMENT_RULES[kind].maxFiles) {
    throw new ValidationError(UPLOAD_NOT_ALLOWED);
  }
  if (ids.length === 0) {
    return;
  }
  const rows = await createAttachmentRepository(ctx.db).findManyByIds(ids);
  for (const id of ids) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || row.status === "DELETED") {
      throw new ValidationError(UPLOAD_EXPIRED);
    }
    if (row.kind !== kind) {
      throw new ValidationError(UPLOAD_NOT_ALLOWED);
    }
    if (row.status === "ATTACHED") {
      if (owner && isOwnedBy(row, owner)) {
        continue;
      }
      throw new ValidationError(UPLOAD_NOT_ALLOWED);
    }
    if (row.uploadedById !== uploader.id) {
      throw new ValidationError(UPLOAD_NOT_ALLOWED);
    }
    if (!(await ctx.storage.head(row.objectKey))) {
      throw new ValidationError(UPLOAD_INCOMPLETE);
    }
  }
};

/**
 * Inside the owner's write: makes `ids` the owner's files of the kind. New ids (checked by
 * `assertUploaded`) are attached; the owner's other files become DELETED and their objects are
 * deleted after commit. A pending row the sweeper expired in between fails the write.
 */
export const syncAttachments = async (
  ctx: RequestContext,
  { tx, afterCommit }: TransactionContext,
  { kind, owner, ids }: { kind: AttachmentKind; owner: AttachmentOwner; ids: readonly string[] },
): Promise<void> => {
  const uploader = uploaderOf(ctx);
  const attachments = createAttachmentRepository(tx);
  const current = await attachments.findAttached(owner, kind);
  const currentIds = new Set(current.map((row) => row.id));
  const added = ids.filter((id) => !currentIds.has(id));
  const removed = current.filter((row) => !ids.includes(row.id)).map((row) => row.id);

  if (added.length > 0) {
    const attached = await attachments.attach(added, { uploadedById: uploader.id, kind, owner });
    if (attached !== added.length) {
      throw new ValidationError(UPLOAD_EXPIRED);
    }
  }
  if (removed.length > 0) {
    await attachments.markDeleted(removed, "ATTACHED");
    afterCommit(() =>
      Promise.all(
        removed.map((id) =>
          enqueueAttachmentDeleteJob(ctx.attachmentDeleteQueue, id, ctx.requestId),
        ),
      ),
    );
  }
};

/** The owner's files of a kind with read URLs, for the owner's read procedure. */
export const viewsOf = async (
  ctx: RequestContext,
  owner: AttachmentOwner,
  kind: AttachmentKind,
): Promise<AttachmentView[]> => {
  const rows = await createAttachmentRepository(ctx.db).findAttached(owner, kind);
  return Promise.all(
    rows.map(async (row) => {
      const read = await ctx.storage.createReadUrl({
        key: row.objectKey,
        fileName: row.fileName,
        expiresInSeconds: ATTACHMENT_URL_TTL_SECONDS,
      });
      return {
        id: row.id,
        fileName: row.fileName,
        contentType: row.contentType,
        size: row.size,
        url: read.url,
      };
    }),
  );
};
