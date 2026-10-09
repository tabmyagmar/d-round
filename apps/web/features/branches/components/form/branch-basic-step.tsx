"use client";

import { useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";

import { ContentCard } from "@repo/ui/components/composed/content-card";
import { FieldGroup } from "@repo/ui/components/field";
import {
  ComboboxField,
  MultiSelectField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from "@repo/ui/components/form";
import { BRANCH_MEMO_MAX, CHARGERS_MAX, formatPhoneNumber } from "@repo/validation";
import type { BranchFormValues, SourceArea } from "@repo/validation";

import { NameFields } from "@/components/name-fields";
import { AddressFields } from "@/components/source/address-fields";
import type { AddressParts } from "@/components/source/address-fields";
import { codeOptions, regionsIn } from "@/components/source/hierarchy-options";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { AREA_OPTIONS } from "@/components/source/source-labels";
import type { ChargerChoice, ClientOption } from "@/features/branches/types";
import { POSITION_OPTIONS } from "@/lib/position-labels";

export type BranchBasicStepProps = {
  control: Control<BranchFormValues>;
  /** 就業先部署登録 or 就業先部署編集: the first card's title. */
  title: string;
  hierarchy: SourceHierarchy;
  /** The clients matching the picker's search (and an edited branch's own). */
  clientOptions: readonly ClientOption[];
  clientsLoading: boolean;
  /** The text typed into クライアント名, for the server search. */
  onClientSearch: (search: string) => void;
  chargerOptions: readonly ChargerChoice[];
  chargersLoading: boolean;
  findAddress: (postCode: string) => Promise<AddressParts | null>;
};

/**
 * The first step, the legacy BranchFormStep1's four cards and order: the 就業先 (クライアント名
 * searched on the server, 就業先番号, 名, カナ, one エリア, one 地域 of it — every region until an
 * エリア is chosen, as the legacy — and 担当者), the 部署 with its address, the 連絡担当者 and the
 * メモ.
 */
export const BranchBasicStep = ({
  control,
  title,
  hierarchy,
  clientOptions,
  clientsLoading,
  onClientSearch,
  chargerOptions,
  chargersLoading,
  findAddress,
}: BranchBasicStepProps) => {
  // A new branch starts without an エリア (the form's type cannot say so): every region is on
  // offer until one is chosen, as the legacy.
  const area = useWatch({ control, name: "area" }) as SourceArea | undefined;
  const regions = area ? regionsIn(hierarchy.regions, [area]) : hierarchy.regions;

  return (
    <>
      <ContentCard title={title}>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <ComboboxField
              control={control}
              name="clientId"
              label="クライアント名"
              placeholder="クライアント名"
              options={clientOptions.map((client) => ({ value: client.id, label: client.name }))}
              onSearch={onClientSearch}
              serverFiltered
              loading={clientsLoading}
              required
            />
            <NumberField
              control={control}
              name="number"
              label="就業先番号"
              placeholder="就業先番号"
              min={1}
              inputMode="numeric"
              required
            />
            <TextField
              control={control}
              name="name"
              label="就業先名"
              placeholder="就業先名"
              maxLength={100}
              required
            />
            <TextField
              control={control}
              name="nameKana"
              label="就業先名（カタカナ）"
              placeholder="就業先名（カタカナ）"
              maxLength={100}
              required
            />
            <SelectField
              control={control}
              name="area"
              label="エリア"
              placeholder="エリア"
              options={AREA_OPTIONS}
              required
            />
            <SelectField
              control={control}
              name="regionCode"
              label="地域"
              placeholder="地域"
              options={codeOptions(regions)}
              valueAs="number"
              pruneToOptions={hierarchy.ready}
              required
            />
            <MultiSelectField
              control={control}
              name="chargerUserIds"
              label="担当者"
              placeholder="担当者を選択"
              options={chargerOptions.map((charger) => ({
                value: charger.id,
                label: charger.name,
              }))}
              emptyMessage="該当なし"
              max={CHARGERS_MAX}
              loading={chargersLoading}
              required
            />
          </div>
        </FieldGroup>
      </ContentCard>

      <ContentCard title="就業先部署・住所情報登録">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              control={control}
              name="departmentNumber"
              label="部署番号"
              placeholder="部署番号"
              min={1}
              inputMode="numeric"
              required
            />
            <TextField
              control={control}
              name="departmentName"
              label="部署名"
              placeholder="部署名"
              maxLength={100}
              required
            />
            <TextField
              control={control}
              name="departmentNameKana"
              label="部署名（カタカナ）"
              placeholder="部署名（カタカナ）"
              maxLength={100}
              required
            />
            <TextField
              control={control}
              name="departmentFax"
              type="tel"
              label="FAX"
              placeholder="03-1234-5678"
              format={formatPhoneNumber}
              emptyAs="null"
            />
          </div>
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
        </FieldGroup>
      </ContentCard>

      <ContentCard title="連絡担当者情報登録">
        <FieldGroup>
          <NameFields
            control={control}
            names={{
              lastName: "contactLastName",
              firstName: "contactFirstName",
              lastNameKana: "contactLastNameKana",
              firstNameKana: "contactFirstNameKana",
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={control}
              name="contactPosition"
              label="役職"
              placeholder="役職"
              options={POSITION_OPTIONS}
              required
            />
            <TextField
              control={control}
              name="contactEmail"
              type="email"
              label="メールアドレス"
              placeholder="メールアドレス"
              autoComplete="email"
              required
            />
          </div>
        </FieldGroup>
      </ContentCard>

      <ContentCard title="メモ">
        <TextareaField
          control={control}
          name="memo"
          label="メモ"
          placeholder="メモを入力してください。"
          rows={4}
          maxLength={BRANCH_MEMO_MAX}
          emptyAs="null"
        />
      </ContentCard>
    </>
  );
};
