import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";
import type { ClientFormValues } from "@repo/validation";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { areaNamesOf, postCodeLabel } from "@/components/source/source-labels";
import type { ChargerChoice } from "@/features/clients/types";
import { orderTypeNamesOf } from "@/features/clients/utils/client-labels";

export type ClientFormConfirmProps = {
  /** クライアント情報登録 or クライアント情報編集, as on the first step. */
  title: string;
  values: ClientFormValues;
  hierarchy: SourceHierarchy;
  /** Names the chosen 担当者. */
  chargers: readonly ChargerChoice[];
};

/**
 * 確認, the legacy ClientFormConfirm: every value of the first step in one card, read-only, in the
 * legacy order, before 追加 / 保存.
 */
export const ClientFormConfirm = ({
  title,
  values,
  hierarchy,
  chargers,
}: ClientFormConfirmProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <DescriptionList
        items={[
          { label: "クライアント番号", value: values.number },
          { label: "クライアント名", value: values.name },
          { label: "クライアント名（カタカナ）", value: values.nameKana },
          {
            label: "担当者",
            value: values.chargerUserIds
              .map((id) => chargers.find((charger) => charger.id === id)?.name ?? id)
              .join("、"),
          },
          { label: "エリア", value: areaNamesOf(values) },
          {
            label: "地域",
            value: values.regionCodes
              .map(
                (code) =>
                  hierarchy.regions.find((region) => region.code === code)?.name ?? String(code),
              )
              .join("、"),
          },
          { label: "郵便番号", value: postCodeLabel(values.address.postCode) },
          { label: "住所(県名)", value: values.address.pref },
          { label: "住所(市町村名)", value: values.address.cityTown },
          { label: "住所", value: values.address.address1 },
          { label: "電話番号", value: values.phoneNumber },
          { label: "FAX", value: values.fax },
          { label: "URL", value: values.webUrl },
          { label: "受注区分", value: orderTypeNamesOf(values.orderTypes) },
        ]}
      />
    </CardContent>
  </Card>
);
