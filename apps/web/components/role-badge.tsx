import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { StatusTone } from "@repo/ui/components/composed/status-badge";
import type { Role } from "@repo/validation";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr_manager: "HR manager",
  dept_head: "Department head",
  member: "Member",
};

const ROLE_TONES: Record<Role, StatusTone> = {
  admin: "danger",
  hr_manager: "info",
  dept_head: "warning",
  member: "neutral",
};

/** Unknown roles (data older than the enum) render as neutral text instead of crashing. */
export const RoleBadge = ({ role }: { role: string | null | undefined }) => {
  const known = role && role in ROLE_LABELS ? (role as Role) : null;
  return (
    <StatusBadge tone={known ? ROLE_TONES[known] : "neutral"}>
      {known ? ROLE_LABELS[known] : (role ?? "unknown")}
    </StatusBadge>
  );
};
