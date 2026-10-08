"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";

import { todayIsoDay } from "@repo/dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { FieldGroup } from "@repo/ui/components/field";
import {
  ArrayField,
  DateField,
  MultiSelectField,
  NumberField,
  RadioField,
  SelectField,
  TextareaField,
  TextField,
} from "@repo/ui/components/form";
import { ja } from "@repo/ui/lib/calendar-locale";
import { ageOf, STAFF_LIST_MAX } from "@repo/validation";
import type { StaffFormValues } from "@repo/validation";

import { NameFields } from "@/components/name-fields";
import { AddressFields } from "@/components/source/address-fields";
import type { AddressParts } from "@/components/source/address-fields";
import { HierarchyFields } from "@/components/source/hierarchy-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type { ChargerChoice } from "@/features/staff/types";
import { newJobHistory } from "@/features/staff/utils/staff-form-input";
import { EMPLOYEE_TYPE_OPTIONS, GENDER_OPTIONS } from "@/features/staff/utils/staff-labels";
import { POSITION_OPTIONS } from "@/lib/position-labels";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type StaffBasicStepProps = {
  control: Control<StaffFormValues>;
  /** スタッフ情報登録 or スタッフ情報編集. */
  title: string;
  hierarchy: SourceHierarchy;
  /** 担当者 who cover the chosen regions (and the stored ones of an edited staff). */
  chargerOptions: readonly ChargerChoice[];
  /** The options answer for the chosen regions, so chosen 担当者 they leave out are dropped. */
  chargersReady: boolean;
  chargersLoading: boolean;
  findAddress: (postCode: string) => Promise<AddressParts | null>;
};

/**
 * Step 1, the legacy StaffFormStep1's cards and order: the staff (雇用区分 … 役職; エリア → 地域 →
 * 都道府県 → 担当者 cascade), 住所・連絡先情報登録 and 在籍情報. 年齢 follows 生年月日. The legacy
 * file upload comes with its own ticket.
 */
export const StaffBasicStep = ({
  control,
  title,
  hierarchy,
  chargerOptions,
  chargersReady,
  chargersLoading,
  findAddress,
}: StaffBasicStepProps) => {
  // A birthday lies in the past; today (in Japan) is read once, not on every render.
  const [today] = useState(todayIsoDay);
  const birthday = useWatch({ control, name: "birthday" });
  const regionCodes = useWatch({ control, name: "regionCodes" });
  const age = ISO_DATE.test(birthday) ? ageOf(birthday) : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={control}
                name="employeeType"
                label="雇用区分"
                placeholder="雇用区分を選択"
                options={EMPLOYEE_TYPE_OPTIONS}
                required
              />
              <NumberField
                control={control}
                name="employeeNumber"
                label="スタッフ番号"
                placeholder="番号を入力"
                min={1}
                inputMode="numeric"
                required
              />
            </div>
            <NameFields control={control} />
            <div className="grid gap-4 sm:grid-cols-2">
              <HierarchyFields
                control={control}
                hierarchy={hierarchy}
                names={{
                  areas: "areas",
                  regionCodes: "regionCodes",
                  prefectureCodes: "prefectureCodes",
                }}
                required
              />
              <MultiSelectField
                control={control}
                name="chargerUserIds"
                label="担当者名"
                placeholder="担当者を選択"
                options={chargerOptions.map((charger) => ({
                  value: charger.id,
                  label: charger.name,
                }))}
                emptyMessage={regionCodes.length > 0 ? "該当なし" : "地域を選択してください"}
                max={STAFF_LIST_MAX}
                loading={chargersLoading}
                pruneToOptions={chargersReady}
                required
              />
              <DateField
                control={control}
                name="birthday"
                label="生年月日"
                placeholder="YYYY/MM/DD"
                max={today}
                locale="ja-JP"
                calendarLocale={ja}
                {...(age === null ? {} : { description: `年齢 ${String(age)}歳` })}
                required
              />
              <RadioField
                control={control}
                name="gender"
                label="性別"
                options={GENDER_OPTIONS}
                orientation="horizontal"
                required
              />
              <TextField
                control={control}
                name="branchName"
                label="支店名"
                placeholder="支店名"
                maxLength={100}
                required
              />
              <SelectField
                control={control}
                name="position"
                label="役職"
                placeholder="役職を選択"
                options={POSITION_OPTIONS}
                required
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>住所・連絡先情報登録</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <AddressFields
              control={control}
              names={{
                postCode: "address.postCode",
                pref: "address.pref",
                cityTown: "address.cityTown",
                address1: "address.address1",
              }}
              findAddress={findAddress}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={control}
                name="phoneNumber"
                type="tel"
                label="電話番号"
                placeholder="090-1234-5678"
                autoComplete="tel"
                required
              />
              <TextField
                control={control}
                name="emergencyPhoneNumber"
                type="tel"
                label="緊急連絡先（電話番号）"
                placeholder="090-1234-5678"
                emptyAs="null"
              />
            </div>
            <TextField
              control={control}
              name="email"
              type="email"
              label="メールアドレス"
              autoComplete="email"
              emptyAs="null"
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>在籍情報</CardTitle>
        </CardHeader>
        <CardContent>
          <ArrayField
            control={control}
            name="jobHistories"
            label="在籍情報"
            hideLabel
            newItem={newJobHistory}
            max={STAFF_LIST_MAX}
            addLabel="在籍情報を追加"
            emptyMessage="在籍情報はありません"
            renderRow={({ index }) => (
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  control={control}
                  name={`jobHistories.${index}.hireDate`}
                  label="入社日"
                  placeholder="YYYY/MM/DD"
                  locale="ja-JP"
                  calendarLocale={ja}
                  required
                />
                <DateField
                  control={control}
                  name={`jobHistories.${index}.resignationDate`}
                  label="退職日"
                  placeholder="YYYY/MM/DD"
                  locale="ja-JP"
                  calendarLocale={ja}
                  nullable
                />
                <TextareaField
                  control={control}
                  name={`jobHistories.${index}.resignationReason`}
                  label="退職理由"
                  rows={2}
                  maxLength={1000}
                  emptyAs="null"
                  className="sm:col-span-2"
                />
              </div>
            )}
          />
        </CardContent>
      </Card>
    </>
  );
};
