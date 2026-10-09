import type { SelectOption } from "@repo/ui/components/form";
import { GENERAL_STATUSES } from "@repo/validation";
import type { GeneralStatus } from "@repo/validation";

/**
 * 利用中 / 保留 / 停止 of a クライアント or a 就業先部署: the legacy EnumGeneralStatus labels (停止 was
 * `DELETE`). App-level because the clients and branches features both carry the status.
 */
export const GENERAL_STATUS_LABELS: Record<GeneralStatus, string> = {
  ACTIVE: "利用中",
  INACTIVE: "保留",
  SUSPENDED: "停止",
};

export const GENERAL_STATUS_OPTIONS: SelectOption<GeneralStatus>[] = GENERAL_STATUSES.map(
  (status) => ({ value: status, label: GENERAL_STATUS_LABELS[status] }),
);
