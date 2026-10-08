import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";
import { formatDate } from "@repo/ui/components/form";
import { ageOf } from "@repo/validation";

import { areaNamesOf, regionNamesOf } from "@/components/source/source-labels";
import type { StaffDetail } from "@/features/staff/types";
import { EMPLOYEE_TYPE_LABELS, GENDER_LABELS } from "@/features/staff/utils/staff-labels";
import { POSITION_LABELS } from "@/lib/position-labels";

/**
 * スタッフ情報, the legacy StaffInfo's rows and order, with 役職 (the legacy form asked for it, its
 * detail left it out). 担当者名 lists every current 担当者; the legacy showed two and a toggle.
 */
export const StaffInfoCard = ({ staff }: { staff: StaffDetail }) => (
  <Card>
    <CardHeader>
      <CardTitle>スタッフ情報</CardTitle>
    </CardHeader>
    <CardContent>
      <DescriptionList
        items={[
          { label: "雇用区分", value: EMPLOYEE_TYPE_LABELS[staff.employeeType] },
          { label: "スタッフ番号", value: staff.employeeNumber },
          { label: "姓", value: staff.lastName },
          { label: "名", value: staff.firstName },
          { label: "セイ", value: staff.lastNameKana },
          { label: "メイ", value: staff.firstNameKana },
          { label: "エリア", value: areaNamesOf(staff) },
          { label: "地域", value: regionNamesOf(staff) },
          {
            label: "都道府県",
            value: staff.prefectures.map((prefecture) => prefecture.prefecture.name).join("、"),
          },
          {
            label: "担当者名",
            value: staff.chargers
              .filter((charger) => charger.unassignedAt === null)
              .map((charger) => charger.user.name)
              .join("、"),
          },
          { label: "支店名", value: staff.branchName },
          { label: "役職", value: staff.position ? POSITION_LABELS[staff.position] : null },
          {
            label: "生年月日",
            value: staff.birthday ? formatDate(staff.birthday, "ja-JP") : null,
          },
          {
            label: "年齢",
            // A DATE column arrives as midnight UTC: its ISO day is the stored day.
            value: staff.birthday ? `${ageOf(staff.birthday.toISOString().slice(0, 10))}歳` : null,
          },
          { label: "性別", value: GENDER_LABELS[staff.gender] },
        ]}
      />
    </CardContent>
  </Card>
);
