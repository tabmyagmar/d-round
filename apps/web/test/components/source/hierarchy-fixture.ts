import type { SourceHierarchy } from "@/components/source/hierarchy-options";

/** Three regions over both areas, one prefecture each — enough to see every cascade. */
export const HIERARCHY: SourceHierarchy = {
  regions: [
    { code: 1, name: "北海道", area: "EAST" },
    { code: 4, name: "南関東", area: "EAST" },
    { code: 7, name: "関西", area: "WEST" },
  ],
  prefectures: [
    { code: 1, name: "北海道", regionCode: 1 },
    { code: 13, name: "東京都", regionCode: 4 },
    { code: 27, name: "大阪府", regionCode: 7 },
  ],
  ready: true,
};
