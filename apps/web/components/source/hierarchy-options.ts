import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@repo/api/router";
import type { SelectOption } from "@repo/ui/components/form";
import type { SourceArea } from "@repo/validation";

/**
 * The エリア → 地域 → 都道府県 hierarchy behind the users' and staff's pickers and filters, as
 * pure functions over the `source` router's data (node-tested).
 */

type SourceOutputs = inferRouterOutputs<AppRouter>["source"];
export type SourceRegion = SourceOutputs["regions"][number];
export type SourcePrefecture = SourceOutputs["prefectures"][number];

/** The reference data a form or filter receives; `ready` once both lists have loaded. */
export type SourceHierarchy = {
  regions: readonly SourceRegion[];
  prefectures: readonly SourcePrefecture[];
  ready: boolean;
};

/** The regions of the given areas. */
export const regionsIn = (
  regions: readonly SourceRegion[],
  areas: readonly SourceArea[],
): SourceRegion[] => regions.filter((region) => areas.includes(region.area));

/** The prefectures of the given regions. */
export const prefecturesIn = (
  prefectures: readonly SourcePrefecture[],
  regionCodes: readonly number[],
): SourcePrefecture[] =>
  prefectures.filter((prefecture) => regionCodes.includes(prefecture.regionCode));

/** "4 - 南関東": how the legacy forms label regions and prefectures. */
export const codeOptions = (items: readonly { code: number; name: string }[]): SelectOption[] =>
  items.map((item) => ({ value: String(item.code), label: `${String(item.code)} - ${item.name}` }));

/** "南関東": how the legacy filters label them. */
export const nameOptions = (items: readonly { code: number; name: string }[]): SelectOption[] =>
  items.map((item) => ({ value: String(item.code), label: item.name }));

/** A list filter's hierarchy selection; empty lists mean "any". */
export type HierarchySelection = {
  areas: SourceArea[];
  regionCodes: number[];
  prefectureCodes: number[];
};

/**
 * What a filter offers for a selection: with no area chosen every region, otherwise the areas'
 * regions; with no region chosen the prefectures of those regions, otherwise the chosen ones'.
 */
export const filterPools = (
  hierarchy: Pick<SourceHierarchy, "regions" | "prefectures">,
  selection: Pick<HierarchySelection, "areas" | "regionCodes">,
): { regions: SourceRegion[]; prefectures: SourcePrefecture[] } => {
  const regions =
    selection.areas.length === 0
      ? [...hierarchy.regions]
      : regionsIn(hierarchy.regions, selection.areas);
  const regionCodes =
    selection.regionCodes.length === 0
      ? regions.map((region) => region.code)
      : selection.regionCodes;
  return { regions, prefectures: prefecturesIn(hierarchy.prefectures, regionCodes) };
};

/** The selection after a filter change: regions and prefectures outside the new pools drop. */
export const narrowSelection = (
  hierarchy: Pick<SourceHierarchy, "regions" | "prefectures">,
  selection: HierarchySelection,
): HierarchySelection => {
  const regionPool = filterPools(hierarchy, { areas: selection.areas, regionCodes: [] }).regions;
  const regionCodes = selection.regionCodes.filter((code) =>
    regionPool.some((region) => region.code === code),
  );
  const prefecturePool = filterPools(hierarchy, {
    areas: selection.areas,
    regionCodes,
  }).prefectures;
  const prefectureCodes = selection.prefectureCodes.filter((code) =>
    prefecturePool.some((prefecture) => prefecture.code === code),
  );
  return { areas: selection.areas, regionCodes, prefectureCodes };
};
