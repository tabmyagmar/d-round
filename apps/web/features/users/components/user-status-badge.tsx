import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { UserStatus } from "@repo/validation";

import { USER_STATUS_LABELS } from "@/features/users/utils/user-labels";

export const UserStatusBadge = ({ status }: { status: UserStatus }) => (
  <StatusBadge tone={status === "active" ? "success" : "neutral"}>
    {USER_STATUS_LABELS[status]}
  </StatusBadge>
);
