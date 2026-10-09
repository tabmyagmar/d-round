import type { Attachment, AttachmentKind, AttachmentStatus } from "../generated/prisma/client";
import type { DbClient } from "../utils/transaction";

export type CreateAttachmentData = {
  kind: AttachmentKind;
  objectKey: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedById: string;
};

/** The owner column an attachment is attached to; the kind decides which (a service rule). */
export type AttachmentOwner = { userId: string } | { staffId: string };

export type AttachData = {
  uploadedById: string;
  kind: AttachmentKind;
  owner: AttachmentOwner;
};

/**
 * Files in the bucket and the rows that own them (PENDING → ATTACHED → DELETED → gone). See
 * docs/adr/0012-attachments.md. Which transition is allowed when is the service's and the worker's
 * decision; every write here names the status it expects, so a racing sweeper never undoes an
 * attach.
 */
export const createAttachmentRepository = (db: DbClient) => ({
  create: (data: CreateAttachmentData): Promise<Attachment> => db.attachment.create({ data }),

  findById: (id: string): Promise<Attachment | null> => db.attachment.findUnique({ where: { id } }),

  findManyByIds: (ids: readonly string[]): Promise<Attachment[]> =>
    db.attachment.findMany({ where: { id: { in: [...ids] } } }),

  /** The owner's attached files of one kind, in upload order. */
  findAttached: (owner: AttachmentOwner, kind: AttachmentKind): Promise<Attachment[]> =>
    db.attachment.findMany({
      where: { ...owner, kind, status: "ATTACHED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),

  /** PENDING rows of this uploader and kind become the owner's; returns how many moved. */
  attach: async (ids: readonly string[], { uploadedById, kind, owner }: AttachData) => {
    const { count } = await db.attachment.updateMany({
      where: { id: { in: [...ids] }, status: "PENDING", uploadedById, kind },
      data: { ...owner, status: "ATTACHED", attachedAt: new Date() },
    });
    return count;
  },

  /** Rows still in `from` become DELETED (the object delete follows); returns how many moved. */
  markDeleted: async (ids: readonly string[], from: Exclude<AttachmentStatus, "DELETED">) => {
    const { count } = await db.attachment.updateMany({
      where: { id: { in: [...ids] }, status: from },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return count;
  },

  /** PENDING rows the sweeper expires: created before `before`, oldest first. */
  findPendingBefore: (before: Date, limit: number): Promise<Attachment[]> =>
    db.attachment.findMany({
      where: { status: "PENDING", createdAt: { lt: before } },
      orderBy: { createdAt: "asc" },
      take: limit,
    }),

  /** DELETED rows whose object delete has not finished: deleted before `before`, oldest first. */
  findDeletedBefore: (before: Date, limit: number): Promise<Attachment[]> =>
    db.attachment.findMany({
      where: { status: "DELETED", deletedAt: { lt: before } },
      orderBy: { deletedAt: "asc" },
      take: limit,
    }),

  /** Removes the row once its object is gone; 0 when it already was (jobs may repeat). */
  deleteById: async (id: string) => {
    const { count } = await db.attachment.deleteMany({ where: { id } });
    return count;
  },
});

export type AttachmentRepository = ReturnType<typeof createAttachmentRepository>;
