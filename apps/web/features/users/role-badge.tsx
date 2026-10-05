import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { StatusTone } from "@repo/ui/components/composed/status-badge";
import type { Role } from "@repo/validation";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

const ROLE_TONES: Record<Role, StatusTone> = {
  super_admin: "danger",
  admin: "warning",
  manager: "info",
  staff: "neutral",
};

/**
 * Interim until the ability check (Commit E2): roles that do not get the "Users" entry points.
 * Lives here (no "use client") so the server-rendered dashboard and the client shell share it.
 */
export const BROWSE_USERS_HIDDEN_ROLES: readonly Role[] = ["manager", "staff"];

/** Unknown roles (data older than the enum) render as neutral text instead of crashing. */
export const RoleBadge = ({ role }: { role: string | null | undefined }) => {
  const known = role && role in ROLE_LABELS ? (role as Role) : null;
  return (
    <StatusBadge tone={known ? ROLE_TONES[known] : "neutral"}>
      {known ? ROLE_LABELS[known] : (role ?? "unknown")}
    </StatusBadge>
  );
};
