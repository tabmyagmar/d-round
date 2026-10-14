import { TIME_ZONE, dayjs } from "@repo/dayjs";
import type { SelectOption } from "@repo/ui/components/form";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUSES,
  auditChangeSchema,
  isAuditAction,
  isAuditEntityType,
  ROLE_LABELS,
  roleSchema,
  z,
} from "@repo/validation";
import type { AuditChange, AuditLogStatus } from "@repo/validation";

import type { AuditLogRow } from "@/features/audit-log/types";

/** An action's label; the key itself for one no list names (an action since removed). */
export const actionLabelOf = (action: string): string =>
  isAuditAction(action) ? AUDIT_ACTIONS[action].label : action;

/** A target type's name (担当者, クライアント, …), or `null` for a row without a target. */
export const entityTypeLabelOf = (entityType: string | null): string | null =>
  entityType !== null && isAuditEntityType(entityType)
    ? AUDIT_ENTITY_TYPES[entityType]
    : entityType;

/** Who acted, as the 担当者 column shows it: the user, システム for a job, else the typed address. */
export const actorLabelOf = (
  row: Pick<AuditLogRow, "actorType" | "actorName" | "actorEmail">,
): string => (row.actorType === "SYSTEM" ? "システム" : (row.actorName ?? row.actorEmail ?? "—"));

/** A row's 日付 and 時間, in Japan, as the legacy list wrote them; the detail's 日時 to the second. */
export const dayOf = (date: Date): string => dayjs(date).tz(TIME_ZONE).format("YYYY/MM/DD");
export const timeOf = (date: Date): string => dayjs(date).tz(TIME_ZONE).format("HH:mm");
export const dateTimeOf = (date: Date): string =>
  dayjs(date).tz(TIME_ZONE).format("YYYY/MM/DD HH:mm:ss");

/** An actor's アカウントタイプ, or the key itself for a role the app no longer has. */
export const roleLabelOf = (role: string | null): string | null => {
  const known = roleSchema.safeParse(role);
  return known.success ? ROLE_LABELS[known.data] : role;
};

const auditChangesSchema = z.array(auditChangeSchema);

/** A row's changed fields from its JSON; nothing for a row that has none. */
export const changesOf = (json: unknown): AuditChange[] => {
  const parsed = auditChangesSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
};

export const ACTION_OPTIONS: SelectOption[] = Object.entries(AUDIT_ACTIONS).map(
  ([value, { label }]) => ({ value, label }),
);

export const ENTITY_TYPE_OPTIONS: SelectOption[] = Object.entries(AUDIT_ENTITY_TYPES).map(
  ([value, label]) => ({ value, label }),
);

export const STATUS_OPTIONS: SelectOption<AuditLogStatus>[] = AUDIT_STATUSES.map((status) => ({
  value: status,
  label: AUDIT_STATUS_LABELS[status],
}));
