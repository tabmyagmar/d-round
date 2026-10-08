import type { SelectOption } from "@repo/ui/components/form";
import { SOURCE_AREAS } from "@repo/validation";
import type { SourceArea } from "@repo/validation";

/** エリア labels, as in the legacy app. */
export const AREA_LABELS: Record<SourceArea, string> = {
  EAST: "東日本",
  WEST: "西日本",
};

export const AREA_OPTIONS: SelectOption<SourceArea>[] = SOURCE_AREAS.map((area) => ({
  value: area,
  label: AREA_LABELS[area],
}));

/** エリア by name ("東日本、西日本"), or `null` with none (or nothing to read, e.g. no profile). */
export const areaNamesOf = (holder: { areas: readonly SourceArea[] } | null): string | null =>
  holder && holder.areas.length > 0
    ? holder.areas.map((area) => AREA_LABELS[area]).join("、")
    : null;

/** 地域 by name, or `null` with none: a 担当者 profile's or a スタッフ's regions. */
export const regionNamesOf = (
  holder: { regions: readonly { region: { name: string } }[] } | null,
): string | null =>
  holder && holder.regions.length > 0
    ? holder.regions.map((region) => region.region.name).join("、")
    : null;
