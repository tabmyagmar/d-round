"use client";

import type { Control } from "react-hook-form";

import { ContentCard } from "@repo/ui/components/composed/content-card";
import { FieldGroup } from "@repo/ui/components/field";
import {
  CheckboxGroupField,
  MultiSelectField,
  NumberField,
  TextField,
} from "@repo/ui/components/form";
import { CHARGERS_MAX, formatPhoneNumber } from "@repo/validation";
import type { ClientFormValues } from "@repo/validation";

import { AddressFields } from "@/components/source/address-fields";
import type { AddressParts } from "@/components/source/address-fields";
import { HierarchyFields } from "@/components/source/hierarchy-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import type { ChargerChoice } from "@/features/clients/types";
import { CLIENT_ORDER_TYPE_OPTIONS } from "@/features/clients/utils/client-labels";

export type ClientBasicStepProps = {
  control: Control<ClientFormValues>;
  /** クライアント情報登録 or クライアント情報編集. */
  title: string;
  hierarchy: SourceHierarchy;
  chargerOptions: readonly ChargerChoice[];
  chargersLoading: boolean;
  findAddress: (postCode: string) => Promise<AddressParts | null>;
};

/**
 * The first step, the legacy ClientFormStep1's two cards and order: the client (番号, 名, カナ,
 * エリア → 地域, 担当者) and 住所・連絡先情報登録 (address, 電話番号, FAX, URL, 受注区分). 地域
 * follows エリア as on the staff form; 受注区分 has three options, so checkboxes.
 */
export const ClientBasicStep = ({
  control,
  title,
  hierarchy,
  chargerOptions,
  chargersLoading,
  findAddress,
}: ClientBasicStepProps) => (
  <>
    <ContentCard title={title}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            control={control}
            name="number"
            label="クライアント番号"
            placeholder="クライアント番号"
            min={1}
            inputMode="numeric"
            required
          />
          <TextField
            control={control}
            name="name"
            label="クライアント名"
            placeholder="クライアント名"
            maxLength={100}
            required
          />
          <TextField
            control={control}
            name="nameKana"
            label="クライアント名(カタカナ)"
            placeholder="クライアント名(カタカナ)"
            maxLength={100}
            required
          />
          <HierarchyFields
            control={control}
            hierarchy={hierarchy}
            names={{ areas: "areas", regionCodes: "regionCodes" }}
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

    <ContentCard title="住所・連絡先情報登録">
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
            placeholder="03-1234-5678"
            format={formatPhoneNumber}
            autoComplete="tel"
            required
          />
          <TextField
            control={control}
            name="fax"
            type="tel"
            label="FAX"
            placeholder="03-1234-5678"
            format={formatPhoneNumber}
            emptyAs="null"
          />
          <TextField
            control={control}
            name="webUrl"
            type="url"
            label="URL"
            placeholder="example.com"
            maxLength={255}
            emptyAs="null"
          />
          <CheckboxGroupField
            control={control}
            name="orderTypes"
            label="受注区分"
            options={CLIENT_ORDER_TYPE_OPTIONS}
            orientation="horizontal"
            required
          />
        </div>
      </FieldGroup>
    </ContentCard>
  </>
);
