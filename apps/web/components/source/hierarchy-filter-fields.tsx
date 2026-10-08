"use client";

import { CheckboxGroup } from "@repo/ui/components/composed/checkbox-group";
import { MultiOptionSelect } from "@repo/ui/components/composed/multi-option-select";

import { filterPools, nameOptions, narrowSelection } from "@/components/source/hierarchy-options";
import type { HierarchySelection, SourceHierarchy } from "@/components/source/hierarchy-options";
import { AREA_OPTIONS } from "@/components/source/source-labels";

export type HierarchyFilterFieldsProps = {
  hierarchy: SourceHierarchy;
  selection: HierarchySelection;
  onChange: (selection: HierarchySelection) => void;
  /** 県名, which the staff list filters by and the users list does not. */
  showPrefectures?: boolean;
};

/**
 * The list filter's エリア / 地域 (/ 県名), as the legacy filters: every region while no エリア is
 * chosen, the chosen エリア's regions otherwise, likewise for prefectures under 地域. A change drops
 * what the new choice no longer covers (once the reference data has loaded).
 */
export const HierarchyFilterFields = ({
  hierarchy,
  selection,
  onChange,
  showPrefectures = false,
}: HierarchyFilterFieldsProps) => {
  const pools = filterPools(hierarchy, selection);
  const change = (next: Partial<HierarchySelection>) => {
    const changed = { ...selection, ...next };
    onChange(hierarchy.ready ? narrowSelection(hierarchy, changed) : changed);
  };

  return (
    <>
      <CheckboxGroup
        label="エリア"
        options={AREA_OPTIONS}
        value={selection.areas}
        onValueChange={(areas) => {
          change({ areas });
        }}
        orientation="horizontal"
      />
      <MultiOptionSelect
        label="地域"
        options={nameOptions(pools.regions)}
        value={selection.regionCodes.map(String)}
        onValueChange={(codes) => {
          change({ regionCodes: codes.map(Number) });
        }}
        placeholder="地域を選択"
        emptyMessage="該当なし"
        loadingMessage="読み込み中…"
        loading={!hierarchy.ready}
      />
      {showPrefectures ? (
        <MultiOptionSelect
          label="県名"
          options={nameOptions(pools.prefectures)}
          value={selection.prefectureCodes.map(String)}
          onValueChange={(codes) => {
            change({ prefectureCodes: codes.map(Number) });
          }}
          placeholder="県名を選択"
          emptyMessage="該当なし"
          loadingMessage="読み込み中…"
          loading={!hierarchy.ready}
        />
      ) : null}
    </>
  );
};
