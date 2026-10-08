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
