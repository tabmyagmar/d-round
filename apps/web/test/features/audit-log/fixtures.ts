import type { AuditLogDetail, AuditLogRow } from "@/features/audit-log/types";

/** An `auditLog.list` row as the API returns it: an admin's client edit, in Japan 2026/10/14 09:30. */
export const auditLogRow = (overrides: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: crypto.randomUUID(),
  createdAt: new Date("2026-10-14T00:30:00Z"),
  actorType: "USER",
  actorId: crypto.randomUUID(),
  actorName: "鈴木 花子",
  actorEmail: "admin@example.com",
  actorRole: "admin",
  action: "client.update",
  entityType: "Client",
  entityId: crypto.randomUUID(),
  entityLabel: "1024 株式会社サンプル",
  status: "SUCCESS",
  errorCode: null,
  requestId: "req-1",
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  ...overrides,
});

/** `auditLog.byId`: the row with its changed fields. */
export const auditLogDetail = (overrides: Partial<AuditLogDetail> = {}): AuditLogDetail => ({
  ...auditLogRow(),
  changes: [{ field: "name", before: "旧社名", after: "株式会社サンプル" }],
  ...overrides,
});
