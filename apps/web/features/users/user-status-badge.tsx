import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { UserStatus } from "@repo/validation";

/** The legacy labels: 利用中 (can sign in), 停止 (deactivated). */
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "利用中",
  deactivated: "停止",
};

/** A deactivated user is soft-deleted: `deletedAt` is set. */
export const userStatusOf = (user: { deletedAt: Date | null }): UserStatus =>
  user.deletedAt ? "deactivated" : "active";

export const UserStatusBadge = ({ status }: { status: UserStatus }) => (
  <StatusBadge tone={status === "active" ? "success" : "neutral"}>
    {USER_STATUS_LABELS[status]}
  </StatusBadge>
);
