import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";

import { addressLineOf, postCodeLabel } from "@/components/source/source-labels";
import type { StaffDetail } from "@/features/staff/types";

/** 住所・連絡先情報, the legacy StaffContact's rows; 住所 is the whole address (`addressLineOf`). */
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
            { label: "住所", value: addressLineOf(address) },
            { label: "電話番号", value: staff.phoneNumber },
            { label: "緊急連絡先（電話番号）", value: staff.emergencyPhoneNumber },
            { label: "メールアドレス", value: staff.email },
          ]}
        />
      </CardContent>
    </Card>
  );
};
