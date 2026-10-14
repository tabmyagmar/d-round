import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuditLogRepository, createPrismaClient, withTransaction } from "@repo/database";
import type { AuditLogData } from "@repo/database";
import { listAuditLogsSchema } from "@repo/validation";
import type { ListAuditLogsInput } from "@repo/validation";

import { buildJobContext } from "../../../src/core/context";
import { ForbiddenError, NotFoundError } from "../../../src/core/errors";
import {
  AUDIT_VALUE_MAX_LENGTH,
  diffViews,
  getById,
  history,
  list,
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

  it("keeps the client's address only when it is an IPv4 or IPv6 address", async () => {
    const ctx = await contextFor(h, (await signedInUser(h, { role: "admin" })).headers);
    const cases = [
      ["203.0.113.9", "203.0.113.9"],
      ["2001:db8::1", "2001:db8::1"],
      ["<script>alert(1)</script>", null],
    ] as const;

    const kept = await Promise.all(
      cases.map(async ([sent]) => {
        const entityId = crypto.randomUUID();
        await recordChanges({ ...ctx, ipAddress: sent }, h.db, [entryFor(entityId)]);
        return (await h.db.auditLog.findFirstOrThrow({ where: { entityId } })).ipAddress;
      }),
    );

    expect(kept).toEqual(cases.map(([, expected]) => expected));
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

describe("reading the log", () => {
  const adminContext = async () =>
    contextFor(h, (await signedInUser(h, { role: "admin" })).headers);

  /** A row of a test-unique actor, so a search finds only this test's rows. */
  const rowOf = (actorName: string, data: Partial<AuditLogData>): AuditLogData => ({
    actorType: "USER",
    actorName,
    action: "client.update",
    entityType: "Client",
    status: "SUCCESS",
    ...data,
  });

  it("lists what the search and the filters match, newest first, a period's days in Japan", async () => {
    const ctx = await adminContext();
    const marker = `監査-${crypto.randomUUID()}`;
    await createAuditLogRepository(h.db).createMany([
      // 2026-10-14 00:30, 2026-10-13 23:30 and 2026-10-14 23:59 in Japan.
      rowOf(marker, { entityLabel: "A", createdAt: new Date("2026-10-13T15:30:00Z") }),
      rowOf(marker, {
        entityLabel: "B",
        action: "client.create",
        status: "FAILURE",
        errorCode: "FORBIDDEN",
        createdAt: new Date("2026-10-13T14:30:00Z"),
      }),
      rowOf(marker, {
        entityLabel: "C",
        action: "staff.update",
        entityType: "Staff",
        createdAt: new Date("2026-10-14T14:59:00Z"),
      }),
    ]);
    const labelsOf = async (query: Omit<ListAuditLogsInput, "search">) =>
      (await list(ctx, listAuditLogsSchema.parse({ search: marker, ...query }))).items.map(
        (row) => row.entityLabel,
      );

    expect(await labelsOf({})).toEqual(["C", "A", "B"]);
    expect(await labelsOf({ actions: ["client.update", "client.create"] })).toEqual(["A", "B"]);
    expect(await labelsOf({ entityTypes: ["Staff"] })).toEqual(["C"]);
    expect(await labelsOf({ statuses: ["FAILURE"] })).toEqual(["B"]);
    expect(await labelsOf({ from: "2026-10-14", to: "2026-10-14" })).toEqual(["C", "A"]);
    expect(await labelsOf({ to: "2026-10-13" })).toEqual(["B"]);
    const page = await list(ctx, listAuditLogsSchema.parse({ search: marker }));
    expect(page.total).toBe(3);
    expect(page.items.every((row) => !("changes" in row))).toBe(true);
  });

  it("searches the actor's email whatever its case, and what the target is called", async () => {
    const ctx = await adminContext();
    const local = `kansa-${crypto.randomUUID()}`;
    const label = `対象-${crypto.randomUUID()}`;
    await createAuditLogRepository(h.db).createMany([
      rowOf("監査 太郎", { actorEmail: `${local}@Example.com` }),
      rowOf("監査 太郎", { entityLabel: label }),
    ]);

    const search = async (text: string) =>
      (await list(ctx, listAuditLogsSchema.parse({ search: text }))).total;
    expect(await search(local.toUpperCase())).toBe(1);
    expect(await search(label)).toBe(1);
  });

  it("reads one row with its changes, and an entity's history by cursor", async () => {
    const ctx = await adminContext();
    const entityId = crypto.randomUUID();
    const repo = createAuditLogRepository(h.db);
    const first = await repo.create(
      rowOf("監査", {
        entityId,
        changes: [{ field: "name", before: "旧", after: "新" }],
        createdAt: new Date(Date.now() - 60_000),
      }),
    );
    // Twenty newer rows, all in one moment: the cursor must page them by id as well.
    const now = new Date();
    await repo.createMany(
      Array.from({ length: 20 }, () => rowOf("監査", { entityId, createdAt: now })),
    );

    // A sign-in of the entity is in the log, not in its history.
    await repo.create(rowOf("監査", { entityId, action: "auth.signIn", entityType: "Client" }));

    expect((await getById(ctx, first.id)).changes).toEqual([
      { field: "name", before: "旧", after: "新" },
    ]);
    await expect(getById(ctx, crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    const page = await history(ctx, { entityType: "Client", entityId });
    expect(page.items).toHaveLength(20);
    const rest = await history(ctx, { entityType: "Client", entityId, cursor: page.nextCursor });
    expect(rest.items.map((row) => row.id)).toEqual([first.id]);
    expect(rest.nextCursor).toBeNull();
  });

  it("refuses every read to a role without the grant", async () => {
    const manager = await contextFor(h, (await signedInUser(h, { role: "manager" })).headers);

    await expect(list(manager, listAuditLogsSchema.parse({}))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(getById(manager, crypto.randomUUID())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      history(manager, { entityType: "Client", entityId: crypto.randomUUID() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
