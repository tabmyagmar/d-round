import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";
import type { BranchFormValues } from "@repo/validation";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { AREA_LABELS, postCodeLabel } from "@/components/source/source-labels";
import type { ChargerChoice } from "@/features/branches/types";
import { POSITION_LABELS } from "@/lib/position-labels";

export type BranchFormConfirmProps = {
  /** 就業先部署登録 or 就業先部署編集, as on the first step. */
  title: string;
  values: BranchFormValues;
  hierarchy: SourceHierarchy;
  /** The chosen client's name (the picker's option). */
  clientName: string;
  /** Names the chosen 担当者. */
  chargers: readonly ChargerChoice[];
};

/**
 * 確認, the legacy BranchFormConfirm: the first step's values in its four cards, read-only, in the
 * legacy order, before 追加 / 保存.
 */
export const BranchFormConfirm = ({
  title,
  values,
  hierarchy,
  clientName,
  chargers,
}: BranchFormConfirmProps) => (
  <>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={[
            { label: "クライアント名", value: clientName },
            { label: "就業先番号", value: values.number },
            { label: "就業先名", value: values.name },
            { label: "就業先名（カタカナ）", value: values.nameKana },
            { label: "エリア", value: AREA_LABELS[values.area] },
            {
              label: "地域",
              value:
                hierarchy.regions.find((region) => region.code === values.regionCode)?.name ??
                String(values.regionCode),
            },
            {
              label: "担当者",
              value: values.chargerUserIds
                .map((id) => chargers.find((charger) => charger.id === id)?.name ?? id)
                .join("、"),
            },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>就業先部署・住所情報登録</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={[
            { label: "部署番号", value: values.departmentNumber },
            { label: "部署名", value: values.departmentName },
            { label: "部署名（カタカナ）", value: values.departmentNameKana },
            { label: "郵便番号", value: postCodeLabel(values.address.postCode) },
            { label: "住所(県名)", value: values.address.pref },
            { label: "住所(市町村名)", value: values.address.cityTown },
            { label: "住所", value: values.address.address1 },
            { label: "FAX", value: values.departmentFax },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>連絡担当者情報登録</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={[
            { label: "姓", value: values.contactLastName },
            { label: "名", value: values.contactFirstName },
            { label: "役職", value: POSITION_LABELS[values.contactPosition] },
            { label: "セイ", value: values.contactLastNameKana },
            { label: "メイ", value: values.contactFirstNameKana },
            { label: "メールアドレス", value: values.contactEmail },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>メモ</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm break-words whitespace-pre-wrap">{values.memo ?? "—"}</p>
      </CardContent>
    </Card>
  </>
);
