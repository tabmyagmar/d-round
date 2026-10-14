"use client";

import { ja } from "react-day-picker/locale";

import { CheckboxGroup } from "@repo/ui/components/composed/checkbox-group";
import { DateRangePicker } from "@repo/ui/components/composed/date-range-picker";
import { MultiOptionSelect } from "@repo/ui/components/composed/multi-option-select";
import { toDate, toIsoDate } from "@repo/ui/components/form";
import type { AuditLogStatus } from "@repo/validation";

import type {
  AuditLogFilterChanges,
  AuditLogListFilters,
} from "@/features/audit-log/utils/audit-log-filters";
import {
  ACTION_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from "@/features/audit-log/utils/audit-log-labels";

export type AuditLogFilterContentProps = {
  filters: AuditLogListFilters;
  onChange: (changes: AuditLogFilterChanges) => void;
};

/**
 * The filter popover's fields: アクション (the legacy's only filter), 対象, ステータス and 期間 (the
 * brief's). Loaded with `next/dynamic` when the popover first opens.
 */
export const AuditLogFilterContent = ({ filters, onChange }: AuditLogFilterContentProps) => {
  const from = toDate(filters.from);
  return (
    <div className="flex flex-col gap-3">
      <MultiOptionSelect
        label="アクション"
        options={ACTION_OPTIONS}
        value={filters.actions}
        onValueChange={(actions) => {
          onChange({ actions });
        }}
        placeholder="アクションを選択"
        emptyMessage="該当なし"
      />
      <CheckboxGroup
        label="対象"
        options={ENTITY_TYPE_OPTIONS}
        value={filters.entityTypes}
        onValueChange={(entityTypes) => {
          onChange({ entityTypes });
        }}
      />
      <CheckboxGroup
        label="ステータス"
        options={STATUS_OPTIONS}
        value={filters.statuses}
        orientation="horizontal"
        onValueChange={(statuses: AuditLogStatus[]) => {
          onChange({ statuses });
        }}
      />
      <DateRangePicker
        label="期間"
        value={from ? { from, to: toDate(filters.to) } : undefined}
        onValueChange={(range) => {
          onChange({
            from: range?.from ? toIsoDate(range.from) : null,
            to: range?.to ? toIsoDate(range.to) : null,
          });
        }}
        placeholder="期間を選択"
        clearable
        clearLabel="期間をクリア"
        numberOfMonths={1}
        locale="ja-JP"
        calendarLocale={ja}
      />
    </div>
  );
};
