import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { StatusTone } from "@repo/ui/components/composed/status-badge";
import type { Role } from "@repo/validation";

import { ROLE_LABELS } from "@/features/users/utils/user-labels";

const ROLE_TONES: Record<Role, StatusTone> = {
  super_admin: "danger",
  admin: "warning",
  manager: "info",
  am: "neutral",
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
