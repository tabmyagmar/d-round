import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import type { StatusTone } from "@repo/ui/components/composed/status-badge";
import type { GeneralStatus } from "@repo/validation";

import { GENERAL_STATUS_LABELS } from "@/lib/general-status-labels";

const GENERAL_STATUS_TONES: Record<GeneralStatus, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "warning",
  SUSPENDED: "neutral",
};

/** The status of a クライアント or a 就業先部署, toned as a スタッフ's. */
export const GeneralStatusBadge = ({ status }: { status: GeneralStatus }) => (
  <StatusBadge tone={GENERAL_STATUS_TONES[status]}>{GENERAL_STATUS_LABELS[status]}</StatusBadge>
);
