"use client";

import { useState } from "react";
import type { Control } from "react-hook-form";

import { todayIsoDay } from "@repo/dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { ArrayField, DateField, SelectField, TextField } from "@repo/ui/components/form";
import { ja } from "@repo/ui/lib/calendar-locale";
import { STAFF_LIST_MAX } from "@repo/validation";
import type { StaffFormValues } from "@repo/validation";

import { FAMILY_RELATION_OPTIONS } from "@/features/staff/utils/staff-labels";

const newFamilyMember = (): StaffFormValues["familyMembers"][number] => ({
  lastName: "",
  firstName: "",
  lastNameKana: null,
  firstNameKana: null,
  relation: null,
  birthday: null,
});

/** 家族情報登録, the legacy step 2's first card: 姓 / 名 required, readings, 続柄 and birthday optional. */
export const StaffFamilyMemberFields = ({ control }: { control: Control<StaffFormValues> }) => {
  // A birthday lies in the past; today (in Japan) is read once, not on every render.
  const [today] = useState(todayIsoDay);
  return (
    <Card>
      <CardHeader>
        <CardTitle>家族情報登録</CardTitle>
      </CardHeader>
      <CardContent>
        <ArrayField
          control={control}
          name="familyMembers"
          label="家族情報"
          hideLabel
          newItem={newFamilyMember}
          max={STAFF_LIST_MAX}
          addLabel="家族情報を追加"
          emptyMessage="家族情報はありません"
          renderRow={({ index }) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={control}
                name={`familyMembers.${index}.lastName`}
                label="姓"
                required
              />
              <TextField
                control={control}
                name={`familyMembers.${index}.firstName`}
                label="名"
                required
              />
              <TextField
                control={control}
                name={`familyMembers.${index}.lastNameKana`}
                label="セイ"
                emptyAs="null"
              />
              <TextField
                control={control}
                name={`familyMembers.${index}.firstNameKana`}
                label="メイ"
                emptyAs="null"
              />
              <SelectField
                control={control}
                name={`familyMembers.${index}.relation`}
                label="続柄"
                placeholder="続柄を選択"
                options={FAMILY_RELATION_OPTIONS}
                nullable
              />
              <DateField
                control={control}
                name={`familyMembers.${index}.birthday`}
                label="生年月日"
                placeholder="YYYY/MM/DD"
                max={today}
                locale="ja-JP"
                calendarLocale={ja}
                nullable
              />
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};
