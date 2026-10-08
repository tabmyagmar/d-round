import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { StatusTone } from "@repo/ui/components/composed/status-badge";
import type { StaffStatus } from "@repo/validation";

import { STAFF_STATUS_LABELS } from "@/features/staff/utils/staff-labels";

const STAFF_STATUS_TONES: Record<StaffStatus, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  SUSPENDED: "neutral",
};

export const StaffStatusBadge = ({ status }: { status: StaffStatus }) => (
  <StatusBadge tone={STAFF_STATUS_TONES[status]}>{STAFF_STATUS_LABELS[status]}</StatusBadge>
);
