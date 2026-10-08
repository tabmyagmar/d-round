import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";

import {
  addressLineOf,
  areaNamesOf,
  postCodeLabel,
  regionNamesOf,
} from "@/components/source/source-labels";
import type { ClientDetail } from "@/features/clients/types";
import { orderTypeNamesOf } from "@/features/clients/utils/client-labels";
import { chargerNamesOf } from "@/lib/charger-labels";

/**
 * クライアント情報, the legacy ClientInfo's rows and order. The post code is labelled 郵便番号 (the
 * legacy said 部署番号 there) and 住所 is the whole address, as on the staff detail.
 */
export const ClientInfoCard = ({ client }: { client: ClientDetail }) => (
  <Card>
    <CardHeader>
      <CardTitle>クライアント情報</CardTitle>
    </CardHeader>
    <CardContent>
      <DescriptionList
        items={[
          { label: "クライアント番号", value: client.number },
          { label: "クライアント名", value: client.name },
          { label: "カタカナ", value: client.nameKana },
          { label: "エリア", value: areaNamesOf(client) },
          { label: "地域", value: regionNamesOf(client) },
          { label: "担当者", value: chargerNamesOf(client.chargers) },
          { label: "受注区分", value: orderTypeNamesOf(client.orderTypes) },
          {
            label: "郵便番号",
            value: client.address ? postCodeLabel(client.address.postCode) : null,
          },
          { label: "住所", value: addressLineOf(client.address) },
          { label: "電話番号", value: client.phoneNumber },
          { label: "FAX", value: client.fax },
          { label: "URL", value: client.webUrl },
        ]}
      />
    </CardContent>
  </Card>
);
