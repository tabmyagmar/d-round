import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient, withTransaction } from "@repo/database";

import { buildJobContext } from "../../../src/core/context";
import {
  AUDIT_VALUE_MAX_LENGTH,
  diffViews,
  recordChanges,
  recordFailure,
} from "../../../src/modules/audit-log/audit-log.service";
import type { AuditEntry } from "../../../src/modules/audit-log/audit-log.service";
import { contextDeps, contextFor, createHarness, signedInUser } from "../../support";
import type { TestHarness } from "../../support";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.stop();
});

/** A database nobody listens on: a real client whose every query fails. */
const unreachableDatabase = () =>
  createPrismaClient({ connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none" });

const entryFor = (entityId: string, overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  action: "client.update",
  entityType: "Client",
  entityId,
  entityLabel: "1024 株式会社サンプル",
  changes: [{ field: "name", before: "旧社名", after: "株式会社サンプル" }],
  ...overrides,
});

describe("diffViews", () => {
  it("lists every filled field of a created entity", () => {
    expect(diffViews(null, { name: "株式会社サンプル", fax: "", status: "利用中" })).toEqual([
      { field: "name", before: null, after: "株式会社サンプル" },
      { field: "status", before: null, after: "利用中" },
    ]);
  });

  it("lists only the fields an update changed, in the view's order", () => {
    expect(
      diffViews(
        { name: "旧社名", fax: "03-0000-0000", status: "利用中" },
        { name: "新社名", fax: "", status: "利用中" },
      ),
    ).toEqual([
      { field: "name", before: "旧社名", after: "新社名" },
      { field: "fax", before: "03-0000-0000", after: null },
    ]);
  });

  it("records no field for a delete", () => {
    expect(diffViews({ name: "株式会社サンプル" }, null)).toEqual([]);
  });

  it("says that a masked field changed, never its values", () => {
    const masked = new Set(["phoneNumber"]);

    expect(
      diffViews({ phoneNumber: "090-1111-1111" }, { phoneNumber: "090-2222-2222" }, masked),
    ).toEqual([{ field: "phoneNumber", masked: true }]);
    expect(diffViews({ phoneNumber: "090" }, { phoneNumber: "090" }, masked)).toEqual([]);
  });

  it("cuts a long value and marks the field", () => {
    const long = "あ".repeat(AUDIT_VALUE_MAX_LENGTH + 10);

    expect(diffViews({ memo: "" }, { memo: long })).toEqual([
      { field: "memo", before: null, after: "あ".repeat(AUDIT_VALUE_MAX_LENGTH), truncated: true },
    ]);
  });
});

describe("recordChanges", () => {
  it("records each entity with the actor and the request, inside the write's transaction", async () => {
    const admin = await signedInUser(h, { role: "admin", name: "監査 花子" });
    const headers = new Headers(admin.headers);
    headers.set("user-agent", "Mozilla/5.0 (audit test)");
    const ctx = { ...(await contextFor(h, headers)), ipAddress: "203.0.113.7" };
    const updated = crypto.randomUUID();
    const deleted = crypto.randomUUID();

    await withTransaction(h.db, async ({ tx }) => {
      await recordChanges(ctx, tx, [
        entryFor(updated),
        entryFor(deleted, { action: "client.deleteMany", changes: [] }),
      ]);
    });

    const rows = await h.db.auditLog.findMany({
      where: { entityId: { in: [updated, deleted] } },
      orderBy: { action: "asc" },
    });
    expect(rows.map((row) => [row.action, row.entityId])).toEqual([
      ["client.deleteMany", deleted],
      ["client.update", updated],
    ]);
    expect(rows[1]).toMatchObject({
      actorType: "USER",
      actorId: admin.user.id,
      actorName: "監査 花子",
      actorEmail: admin.email,
      actorRole: "admin",
      entityType: "Client",
      entityLabel: "1024 株式会社サンプル",
      status: "SUCCESS",
      errorCode: null,
      changes: [{ field: "name", before: "旧社名", after: "株式会社サンプル" }],
      requestId: ctx.requestId,
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 (audit test)",
    });
    expect(rows[0]?.changes).toEqual([]);
  });

  it("leaves no row when the write rolls back", async () => {
    const ctx = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
    const entityId = crypto.randomUUID();

    await expect(
      withTransaction(h.db, async ({ tx }) => {
        await recordChanges(ctx, tx, [entryFor(entityId)]);
        throw new Error("the write failed after its audit row");
      }),
    ).rejects.toThrow("the write failed after its audit row");

    expect(await h.db.auditLog.count({ where: { entityId } })).toBe(0);
  });

  it("keeps a job's user and request id, without an address or a browser", async () => {
    const admin = await signedInUser(h, { role: "admin" });
    const ctx = await buildJobContext(
      { userId: admin.user.id, traceId: "csv-confirm-request" },
      contextDeps(h),
    );
    const entityId = crypto.randomUUID();

    await recordChanges(ctx!, h.db, [entryFor(entityId, { action: "client.create" })]);

    expect(await h.db.auditLog.findFirst({ where: { entityId } })).toMatchObject({
      actorId: admin.user.id,
      requestId: "csv-confirm-request",
      ipAddress: null,
      userAgent: null,
    });
  });
});

describe("recordFailure", () => {
  it("records the failed action with its code and the action's target type", async () => {
    const am = await signedInUser(h);
    const ctx = await contextFor(h, am.headers);

    await recordFailure(ctx, "client.create", "FORBIDDEN");

    expect(await h.db.auditLog.findMany({ where: { actorId: am.user.id } })).toEqual([
      expect.objectContaining({
        actorType: "USER",
        action: "client.create",
        entityType: "Client",
        entityId: null,
        status: "FAILURE",
        errorCode: "FORBIDDEN",
        changes: null,
        requestId: ctx.requestId,
      }),
    ]);
  });

  it("never throws, even when the database cannot be reached", async () => {
    const ctx = await contextFor(h, (await signedInUser(h)).headers);
    const unreachable = unreachableDatabase();
    try {
      await expect(
        recordFailure({ ...ctx, db: unreachable }, "client.create", "FORBIDDEN"),
      ).resolves.toBeUndefined();
    } finally {
      await unreachable.$disconnect();
    }
  });
});
