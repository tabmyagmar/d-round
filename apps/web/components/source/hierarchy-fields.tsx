"use client";

import { useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { CheckboxGroupField, MultiSelectField } from "@repo/ui/components/form";
import type { SourceArea } from "@repo/validation";

import { codeOptions, prefecturesIn, regionsIn } from "@/components/source/hierarchy-options";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { AREA_OPTIONS } from "@/components/source/source-labels";

export type HierarchyFieldsProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  hierarchy: SourceHierarchy;
  /** The form's fields: エリア (`string[]`), 地域 and optionally 都道府県 (`number[]`). */
  names: {
    areas: FieldPath<TValues>;
    regionCodes: FieldPath<TValues>;
    prefectureCodes?: FieldPath<TValues>;
  };
  required?: boolean;
  disabled?: boolean;
};

/**
 * エリア → 地域 (→ 都道府県) as form fields, as in the legacy forms: 地域 offers the regions of the
 * chosen エリア, 都道府県 the prefectures of the chosen 地域, and a choice its parent no longer
 * covers drops once the reference data has loaded. Rendered as siblings, so they sit in the
 * form's grid.
 */
export const HierarchyFields = <TValues extends FieldValues>({
  control,
  hierarchy,
  names,
  required = false,
  disabled = false,
}: HierarchyFieldsProps<TValues>) => {
  const areas = (useWatch({ control, name: names.areas }) ?? []) as SourceArea[];
  const regionCodes = (useWatch({ control, name: names.regionCodes }) ?? []) as number[];

  return (
    <>
      <CheckboxGroupField
        control={control}
        name={names.areas}
        label="エリア"
        options={AREA_OPTIONS}
        orientation="horizontal"
        required={required}
        disabled={disabled}
      />
      <MultiSelectField
        control={control}
        name={names.regionCodes}
        label="地域"
        placeholder="地域を選択"
        options={codeOptions(regionsIn(hierarchy.regions, areas))}
        valueAs="number"
        pruneToOptions={hierarchy.ready}
        required={required}
        disabled={disabled}
      />
      {names.prefectureCodes ? (
        <MultiSelectField
          control={control}
          name={names.prefectureCodes}
          label="都道府県"
          placeholder="都道府県を選択"
          options={codeOptions(prefecturesIn(hierarchy.prefectures, regionCodes))}
          valueAs="number"
          pruneToOptions={hierarchy.ready}
          required={required}
          disabled={disabled}
        />
      ) : null}
    </>
  );
};
