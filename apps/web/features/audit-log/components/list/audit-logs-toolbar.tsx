"use client";

import { FilterTags } from "@repo/ui/components/composed/filter-tags";
import { ListToolbar } from "@repo/ui/components/composed/list-toolbar";
import { SearchInput } from "@repo/ui/components/composed/search-input";

import { AuditLogFilter } from "@/features/audit-log/components/list/audit-log-filter";
import {
  auditLogFilterTags,
  CLEARED_FILTERS,
  removalOf,
} from "@/features/audit-log/utils/audit-log-filters";
import type {
  AuditLogFilterChanges,
  AuditLogListFilters,
} from "@/features/audit-log/utils/audit-log-filters";

export type AuditLogsToolbarProps = {
  filters: AuditLogListFilters;
  /** URL changes: `null` removes a parameter. */
  onChange: (changes: AuditLogFilterChanges) => void;
};

/** 検索 and the filter popover, then the active filters; the log has no action of its own. */
export const AuditLogsToolbar = ({ filters, onChange }: AuditLogsToolbarProps) => (
  <ListToolbar
    search={
      <SearchInput
        value={filters.search}
        onSearch={(search) => {
          onChange({ search });
        }}
        label="担当者名・メールアドレス・対象で検索"
      />
    }
    filters={<AuditLogFilter filters={filters} onChange={onChange} />}
  >
    <FilterTags
      tags={auditLogFilterTags(filters)}
      onRemove={(key) => {
        onChange(removalOf(key));
      }}
      onClearAll={() => {
        onChange(CLEARED_FILTERS);
      }}
      clearAllLabel="すべてクリア"
      removeLabel={(tag) => `${tag.label}の絞り込みを解除`}
    />
  </ListToolbar>
);
