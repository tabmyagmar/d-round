import type { AuditLogDetail, AuditLogRow } from "@/features/audit-log/types";

/**
 * An `auditLog.list` row as the API returns it (the list's columns only): an admin's client edit,
 * in Japan 2026/10/14 09:30.
 */
export const auditLogRow = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: crypto.randomUUID(),
  createdAt: new Date("2026-10-14T00:30:00Z"),
  actorType: "USER",
  actorName: "鈴木 花子",
  actorEmail: "admin@example.com",
  action: "client.update",
  entityType: "Client",
  entityLabel: "1024 株式会社サンプル",
  status: "SUCCESS",
  ...overrides,
});

/** `auditLog.byId`: the row with the rest of its columns and its changed fields. */
export const auditLogDetail = (overrides: Partial<AuditLogDetail> = {}): AuditLogDetail => ({
  ...auditLogRow(),
  actorId: crypto.randomUUID(),
  actorRole: "admin",
  entityId: crypto.randomUUID(),
  errorCode: null,
  changes: [{ field: "name", before: "旧社名", after: "株式会社サンプル" }],
  requestId: "req-1",
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  ...overrides,
});
