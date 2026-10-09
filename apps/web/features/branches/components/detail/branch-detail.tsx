import { ContentCard } from "@repo/ui/components/composed/content-card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";

import { addressLineOf, AREA_LABELS, postCodeLabel } from "@/components/source/source-labels";
import type { BranchDetail as BranchDetailRow } from "@/features/branches/types";
import { chargerNamesOf } from "@/lib/charger-labels";
import { POSITION_LABELS } from "@/lib/position-labels";

/** Three label / value pairs per row on wide screens, as the legacy cards' three-column grids. */
const THREE_PAIRS =
  "lg:grid-cols-[minmax(6rem,max-content)_1fr_minmax(6rem,max-content)_1fr_minmax(6rem,max-content)_1fr]";

/**
 * The legacy BranchDetail's four cards, for the detail page and the client detail's dialog:
 * 就業先部署情報, 就業先部署・住所情報 (住所 written whole), 連絡担当者情報 and メモ (特に無し when
 * empty). The legacy's 店舗名（カタカナ） is labelled 就業先名（カタカナ）, as in its form.
 */
export const BranchDetail = ({ branch }: { branch: BranchDetailRow }) => (
  <div className="flex flex-col gap-4">
    <ContentCard title="就業先部署情報">
      <DescriptionList
        className={THREE_PAIRS}
        items={[
          { label: "クライアント名", value: branch.client.name },
          { label: "就業先番号", value: branch.number },
          { label: "就業先名", value: branch.name },
          { label: "就業先名（カタカナ）", value: branch.nameKana },
          { label: "エリア", value: AREA_LABELS[branch.area] },
          { label: "地域", value: branch.region.name },
          { label: "担当者", value: chargerNamesOf(branch.chargers) },
        ]}
      />
    </ContentCard>

    <ContentCard title="就業先部署・住所情報">
      <DescriptionList
        className={THREE_PAIRS}
        items={[
          { label: "部署番号", value: branch.departmentNumber },
          { label: "部署名", value: branch.departmentName },
          { label: "部署名（カタカナ）", value: branch.departmentNameKana },
          {
            label: "郵便番号",
            value: branch.address ? postCodeLabel(branch.address.postCode) : null,
          },
          { label: "住所", value: addressLineOf(branch.address) },
          { label: "FAX", value: branch.departmentFax },
        ]}
      />
    </ContentCard>

    <ContentCard title="連絡担当者情報">
      <DescriptionList
        className={THREE_PAIRS}
        items={[
          { label: "姓", value: branch.contactLastName },
          { label: "名", value: branch.contactFirstName },
          { label: "役職", value: POSITION_LABELS[branch.contactPosition] },
          { label: "セイ", value: branch.contactLastNameKana },
          { label: "メイ", value: branch.contactFirstNameKana },
          { label: "メールアドレス", value: branch.contactEmail },
        ]}
      />
    </ContentCard>

    <ContentCard title="メモ">
      <p className="text-sm break-words whitespace-pre-wrap">{branch.memo ?? "特に無し"}</p>
    </ContentCard>
  </div>
);
