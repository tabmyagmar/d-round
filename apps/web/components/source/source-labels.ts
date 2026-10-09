import type { SelectOption } from "@repo/ui/components/form";
import { formatPostCode, SOURCE_AREAS } from "@repo/validation";
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

/** 郵便番号 as the legacy wrote it: `〒160-0022`, from the stored seven digits or a typed code. */
export const postCodeLabel = (postCode: string): string => `〒${formatPostCode(postCode)}`;

/** A stored address: the typed line and the post-code master's parts. */
export type StoredAddress = {
  address1: string;
  sourceAddress: { pref: string; city: string; town: string };
};

/**
 * 住所 as the details show it: the master's 都道府県・市区町村・町域, then the typed line (the legacy
 * showed the typed line only); `null` without an address.
 */
export const addressLineOf = (address: StoredAddress | null): string | null =>
  address
    ? `${address.sourceAddress.pref}${address.sourceAddress.city}${address.sourceAddress.town}${address.address1}`
    : null;
