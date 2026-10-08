import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";

import type { StaffDetail } from "@/features/staff/types";
import { postCodeLabel } from "@/features/staff/utils/staff-labels";

/**
 * 住所・連絡先情報, the legacy StaffContact's rows. 住所 is the whole address: the post-code
 * master's 都道府県・市区町村・町域, then the line typed in the form (the legacy showed the typed line
 * only).
 */
export const StaffContactCard = ({ staff }: { staff: StaffDetail }) => {
  const { address } = staff;
  return (
    <Card>
      <CardHeader>
        <CardTitle>住所・連絡先情報</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          className="sm:grid-cols-[minmax(6rem,max-content)_1fr_minmax(6rem,max-content)_1fr]"
          items={[
            { label: "郵便番号", value: address ? postCodeLabel(address.postCode) : null },
            {
              label: "住所",
              value: address
                ? `${address.sourceAddress.pref}${address.sourceAddress.city}${address.sourceAddress.town}${address.address1}`
                : null,
            },
            { label: "電話番号", value: staff.phoneNumber },
            { label: "緊急連絡先（電話番号）", value: staff.emergencyPhoneNumber },
            { label: "メールアドレス", value: staff.email },
          ]}
        />
      </CardContent>
    </Card>
  );
};
