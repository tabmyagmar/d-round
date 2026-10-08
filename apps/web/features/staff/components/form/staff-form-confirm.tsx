import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { DescriptionList } from "@repo/ui/components/composed/description-list";
import { formatDate, toDate } from "@repo/ui/components/form";
import { ageOf } from "@repo/validation";
import type { StaffFormValues } from "@repo/validation";

import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { areaNamesOf } from "@/components/source/source-labels";
import type { ChargerChoice } from "@/features/staff/types";
import {
  EMPLOYEE_TYPE_LABELS,
  FAMILY_RELATION_LABELS,
  GENDER_LABELS,
  postCodeLabel,
  STAFF_MEMO_TYPE_LABELS,
} from "@/features/staff/utils/staff-labels";
import { POSITION_LABELS } from "@/lib/position-labels";

/** A `yyyy-MM-dd` value as the legacy wrote dates (2026/04/01), or `null`. */
const dateText = (value: string | null): string | null => {
  const date = value ? toDate(value) : undefined;
  return date ? formatDate(date, "ja-JP") : null;
};

/** Names a code from the reference data, the code itself when it is not there. */
const namesOf = (codes: readonly number[], options: readonly { code: number; name: string }[]) =>
  codes
    .map((code) => options.find((option) => option.code === code)?.name ?? String(code))
    .join("、");

export type StaffFormConfirmProps = {
  /** スタッフ情報登録 or スタッフ情報編集, as on step 1. */
  title: string;
  values: StaffFormValues;
  hierarchy: SourceHierarchy;
  /** Names the chosen 担当者. */
  chargers: readonly ChargerChoice[];
};

/**
 * 確認, the legacy StaffFormConfirm: every value of steps 1 and 2 in its card, read-only, before
 * 追加 / 保存; repeated rows are numbered (1. 入社日). The legacy file card comes with the
 * file-upload ticket.
 */
export const StaffFormConfirm = ({ title, values, hierarchy, chargers }: StaffFormConfirmProps) => (
  <>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={[
            { label: "スタッフ番号", value: values.employeeNumber },
            { label: "雇用区分", value: EMPLOYEE_TYPE_LABELS[values.employeeType] },
            {
              label: "担当者名",
              value: values.chargerUserIds
                .map((id) => chargers.find((charger) => charger.id === id)?.name ?? id)
                .join("、"),
            },
            { label: "氏名", value: `${values.lastName} ${values.firstName}` },
            { label: "氏名（カタカナ）", value: `${values.lastNameKana} ${values.firstNameKana}` },
            { label: "支店名", value: values.branchName },
            { label: "エリア", value: areaNamesOf(values) },
            { label: "地域", value: namesOf(values.regionCodes, hierarchy.regions) },
            { label: "都道府県", value: namesOf(values.prefectureCodes, hierarchy.prefectures) },
            { label: "生年月日", value: dateText(values.birthday) },
            { label: "年齢", value: `${String(ageOf(values.birthday))}歳` },
            { label: "性別", value: GENDER_LABELS[values.gender] },
            { label: "役職", value: POSITION_LABELS[values.position] },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>住所・連絡先情報登録</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={[
            { label: "郵便番号", value: postCodeLabel(values.address.postCode) },
            { label: "住所(県名)", value: values.address.pref },
            { label: "住所(市町村名)", value: values.address.cityTown },
            { label: "住所", value: values.address.address1 },
            { label: "電話番号", value: values.phoneNumber },
            { label: "緊急連絡先（電話番号）", value: values.emergencyPhoneNumber },
            { label: "メールアドレス", value: values.email },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>在籍情報</CardTitle>
      </CardHeader>
      <CardContent>
        {values.jobHistories.length > 0 ? (
          <DescriptionList
            items={values.jobHistories.flatMap((job, index) => {
              const n = String(index + 1);
              return [
                { label: `${n}. 入社日`, value: dateText(job.hireDate) },
                { label: `${n}. 退職日`, value: dateText(job.resignationDate) },
                {
                  label: `${n}. 退職理由`,
                  value: job.resignationReason ? (
                    <span className="whitespace-pre-wrap">{job.resignationReason}</span>
                  ) : null,
                },
              ];
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">在籍情報はありません</p>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>家族情報登録</CardTitle>
      </CardHeader>
      <CardContent>
        {values.familyMembers.length > 0 ? (
          <DescriptionList
            items={values.familyMembers.flatMap((member, index) => {
              const n = String(index + 1);
              return [
                { label: `${n}. 姓`, value: member.lastName },
                { label: `${n}. 名`, value: member.firstName },
                { label: `${n}. セイ`, value: member.lastNameKana },
                { label: `${n}. メイ`, value: member.firstNameKana },
                {
                  label: `${n}. 続柄`,
                  value: member.relation ? FAMILY_RELATION_LABELS[member.relation] : null,
                },
                { label: `${n}. 生年月日`, value: dateText(member.birthday) },
              ];
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">家族情報はありません</p>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>メモ</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList
          items={values.memos.map((memo, index) => ({
            label: `${String(index + 1)}. ${STAFF_MEMO_TYPE_LABELS[memo.memoType]}`,
            value: memo.content ? (
              <span className="whitespace-pre-wrap">{memo.content}</span>
            ) : null,
          }))}
        />
      </CardContent>
    </Card>
  </>
);
