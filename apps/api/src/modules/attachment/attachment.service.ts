import { createAttachmentRepository, withTransaction } from "@repo/database";
import type { Attachment, AttachmentOwner, TransactionContext } from "@repo/database";
import { enqueueAttachmentDeleteJob } from "@repo/queue";
import {
  ATTACHMENT_RULES,
  ATTACHMENT_URL_TTL_SECONDS,
  fileExtension,
  objectDeletableAt,
} from "@repo/validation";
import type { AttachmentKind, CreateUploadUrlInput } from "@repo/validation";

import type { RequestContext } from "../../core/context";
import { ForbiddenError, ValidationError } from "../../core/errors";

/**
 * Attachments (docs/adr/0012-attachments.md). The browser asks for an upload URL and writes the
 * file straight to the bucket; the owner's write attaches it with the two guards below, the first
 * before and the second inside its transaction; the owner's read hands out read URLs (`viewsOf`).
 * A file the API writes itself goes through `storeFile` and is attached the same way. Objects are
 * deleted by the worker, after commit.
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
export const UPLOADS_TOO_MANY =
  "アップロード中のファイルが多すぎます。保存してから、もう一度お試しください";

/** Uploads one user may hold unattached at once: forms carry four files at most. */
export const PENDING_UPLOADS_MAX = 20;

/**
 * Which owner a kind belongs to: a プロフィール画像 to a user, a 履歴書 to a staff, a CSV to its import,
 * a ダウンロード's workbook to its export.
 */
export type AttachmentTarget =
  | { kind: "USER_AVATAR"; owner: { userId: string } }
  | { kind: "STAFF_RESUME"; owner: { staffId: string } }
  | { kind: "CSV_IMPORT"; owner: { csvImportId: string } }
  | { kind: "CSV_EXPORT"; owner: { csvExportId: string } };

const OWNER_COLUMNS = {
  USER_AVATAR: "userId",
  STAFF_RESUME: "staffId",
  CSV_IMPORT: "csvImportId",
  CSV_EXPORT: "csvExportId",
} as const satisfies Record<AttachmentKind, "userId" | "staffId" | "csvImportId" | "csvExportId">;

/** The type allows only fitting pairs; this catches a cast, before anything is written. */
const assertOwnerFits = (kind: AttachmentKind, owner: AttachmentOwner): void => {
  if (!(OWNER_COLUMNS[kind] in owner)) {
    throw new Error(`A ${kind} attachment belongs to its ${OWNER_COLUMNS[kind]} owner`);
  }
};

const uploaderOf = (ctx: RequestContext) => {
  if (!ctx.user) {
    throw new ForbiddenError("Authentication required");
  }
  return ctx.user;
};

const isOwnedBy = (row: Attachment, owner: AttachmentOwner): boolean => {
  if ("userId" in owner) {
    return row.userId === owner.userId;
  }
  if ("staffId" in owner) {
    return row.staffId === owner.staffId;
  }
  if ("csvImportId" in owner) {
    return row.csvImportId === owner.csvImportId;
  }
  return row.csvExportId === owner.csvExportId;
};

/**
 * A 履歴書 is picked on the staff form only, by someone who may create or update a staff; a CSV by
 * someone who may upload CSV files (catalog 1401). Who may set a プロフィール画像 is the user
 * write's decision (their own, or `update User`). A ダウンロード's workbook is the API's to write.
 */
const assertMayUpload = (ctx: RequestContext, kind: AttachmentKind): void => {
  if (kind === "CSV_EXPORT") {
    throw new ForbiddenError("CSV exports are written by the API");
  }
  if (
    kind === "STAFF_RESUME" &&
    !ctx.ability.can("create", "Staff") &&
    !ctx.ability.can("update", "Staff")
  ) {
    throw new ForbiddenError("Not allowed to upload staff files");
  }
  if (kind === "CSV_IMPORT" && !ctx.ability.can("create", "SourceCsvHistory")) {
    throw new ForbiddenError("Not allowed to upload CSV files");
  }
};

/** Where a new file of the kind goes: `<folder>/<random uuid><.ext>`. */
const objectKeyOf = (kind: AttachmentKind, fileName: string): string =>
  `${ATTACHMENT_RULES[kind].folder}/${crypto.randomUUID()}${fileExtension(fileName)}`;

/** A PENDING row and a signed PUT for it; the row expires after 24 h unless an owner attaches it. */
export const createUploadUrl = async (
  ctx: RequestContext,
  input: CreateUploadUrlInput,
): Promise<UploadTarget> => {
  const uploader = uploaderOf(ctx);
  assertMayUpload(ctx, input.kind);
  // The uploader's row is locked so parallel requests count one after another: the cap holds.
  const row = await withTransaction(ctx.db, async ({ tx }) => {
    const attachments = createAttachmentRepository(tx);
    await attachments.lockOwner({ userId: uploader.id });
    if ((await attachments.countPending(uploader.id)) >= PENDING_UPLOADS_MAX) {
      throw new ValidationError(UPLOADS_TOO_MANY);
    }
    return attachments.create({
      kind: input.kind,
      objectKey: objectKeyOf(input.kind, input.fileName),
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      uploadedById: uploader.id,
    });
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
 * A file the API writes itself (a CSV ダウンロード): its PENDING row first, so the sweeper deletes the
 * object should the owner's write never attach it, then the object. The owner's write attaches the
 * returned id with `syncAttachments`, as for an upload.
 */
export const storeFile = async (
  ctx: RequestContext,
  kind: AttachmentKind,
  file: { fileName: string; contentType: string; body: Uint8Array },
): Promise<string> => {
  const uploader = uploaderOf(ctx);
  const row = await createAttachmentRepository(ctx.db).create({
    kind,
    objectKey: objectKeyOf(kind, file.fileName),
    fileName: file.fileName,
    contentType: file.contentType,
    size: file.body.length,
    uploadedById: uploader.id,
  });
  await ctx.storage.upload(row.objectKey, file.body, file.contentType);
  return row.id;
};

/**
 * Before the owner's transaction (bucket calls stay out of it): `ids` fit the kind's limit, and
 * every id the owner does not have yet is a PENDING upload of this user and kind whose object is
 * in the bucket. `owner` is undefined on a create.
 */
export const assertUploaded = async <K extends AttachmentKind>(
  ctx: RequestContext,
  kind: K,
  ids: readonly string[],
  owner?: Extract<AttachmentTarget, { kind: K }>["owner"],
): Promise<void> => {
  const uploader = uploaderOf(ctx);
  if (owner) {
    assertOwnerFits(kind, owner);
  }
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
 * deleted after commit. A pending row the sweeper expired in between fails the write. The owner's
 * row is locked first, so two saves of one owner take turns and never both attach.
 */
export const syncAttachments = async (
  ctx: RequestContext,
  { tx, afterCommit }: TransactionContext,
  { kind, owner, ids }: AttachmentTarget & { ids: readonly string[] },
): Promise<void> => {
  const uploader = uploaderOf(ctx);
  assertOwnerFits(kind, owner);
  const attachments = createAttachmentRepository(tx);
  await attachments.lockOwner(owner);
  const current = await attachments.findAttached(owner, kind);
  const currentIds = new Set(current.map((row) => row.id));
  const added = ids.filter((id) => !currentIds.has(id));
  const removed = current.filter((row) => !ids.includes(row.id));

  if (added.length > 0) {
    const attached = await attachments.attach(added, { uploadedById: uploader.id, kind, owner });
    if (attached !== added.length) {
      throw new ValidationError(UPLOAD_EXPIRED);
    }
  }
  if (removed.length > 0) {
    await attachments.markDeleted(
      removed.map((row) => row.id),
      "ATTACHED",
    );
    afterCommit(async () => {
      try {
        // Each delete waits until the file's upload URL has expired: deleted earlier, the URL
        // could put the object back with no row pointing at it.
        await Promise.all(
          removed.map((row) =>
            enqueueAttachmentDeleteJob(ctx.attachmentDeleteQueue, row.id, {
              traceId: ctx.requestId,
              notBefore: objectDeletableAt(row.createdAt),
            }),
          ),
        );
      } catch (error) {
        // The save is committed and the rows say DELETED: the sweeper enqueues them again. Logged
        // as an error, as the email outbox does, so a Redis failure still alerts (ADR 0010).
        ctx.logger.error(
          { err: error, attachmentIds: removed.map((row) => row.id) },
          "attachment delete not enqueued; the sweeper retries",
        );
      }
    });
  }
};

/** The owner's files of a kind with read URLs, for the owner's read procedure. */
export const viewsOf = async (
  ctx: RequestContext,
  { kind, owner }: AttachmentTarget,
): Promise<AttachmentView[]> => {
  assertOwnerFits(kind, owner);
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
