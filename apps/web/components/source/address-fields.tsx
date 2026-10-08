"use client";

import { useRef } from "react";
import { useController } from "react-hook-form";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { toast } from "sonner";

import { FieldGroup } from "@repo/ui/components/field";
import { ReadOnlyField, TextField } from "@repo/ui/components/form";
import { formatPostCode, postCodeSchema } from "@repo/validation";

/** The post-code master's answer: 都道府県, 市区町村, 町域. */
export type AddressParts = { pref: string; city: string; town: string };

export type AddressFieldsProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  names: {
    postCode: FieldPath<TValues>;
    /** 住所(県名) and 住所(市町村名): shown and checked by the form, filled by the lookup. */
    pref: FieldPath<TValues>;
    cityTown: FieldPath<TValues>;
    /** 住所: the line typed after the master's part (番地, building). */
    address1: FieldPath<TValues>;
  };
  /** Looks up a seven-digit post code, `null` when unknown (`source.addressByPostCode`). */
  findAddress: (postCode: string) => Promise<AddressParts | null>;
  disabled?: boolean;
};

/**
 * 郵便番号 → 住所, as the legacy FormAddressField: the post code takes its hyphen as it is typed
 * (`160-0022`), and a complete one is looked up at once and fills the read-only 住所(県名) and 住所(市町村名);

 * an unknown one empties them and says 郵便番号が見つかりません。 (the legacy toast). The legacy
 * 検索 button is not carried over: the lookup runs as the code is typed.
 */
export const AddressFields = <TValues extends FieldValues>({
  control,
  names,
  findAddress,
  disabled,
}: AddressFieldsProps<TValues>) => {
  const { field: pref } = useController({ control, name: names.pref });
  const { field: cityTown } = useController({ control, name: names.cityTown });
  // The code of the latest lookup: an answer for an earlier one arrives too late to count.
  const latestCodeRef = useRef<string | null>(null);

  const fill = (parts: AddressParts | null) => {
    pref.onChange(parts?.pref ?? "");
    cityTown.onChange(parts ? `${parts.city}${parts.town}` : "");
  };

  const lookUp = async (text: string) => {
    const postCode = postCodeSchema.safeParse(text);
    latestCodeRef.current = postCode.success ? postCode.data : null;
    if (!postCode.success) {
      fill(null);
      return;
    }
    try {
      const parts = await findAddress(postCode.data);
      if (latestCodeRef.current === postCode.data) {
        fill(parts);
        if (!parts) {
          toast.error("郵便番号が見つかりません。");
        }
      }
    } catch {
      if (latestCodeRef.current === postCode.data) {
        fill(null);
        toast.error("住所を検索できませんでした");
      }
    }
  };

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          control={control}
          name={names.postCode}
          label="郵便番号"
          required
          placeholder="160-0022"
          autoComplete="postal-code"
          format={formatPostCode}

          {...(disabled === undefined ? {} : { disabled })}
          onValueChange={(text) => {
            void lookUp(text);
          }}
        />
        <ReadOnlyField control={control} name={names.pref} label="住所(県名)" required />
        <ReadOnlyField control={control} name={names.cityTown} label="住所(市町村名)" required />
      </div>
      <TextField
        control={control}
        name={names.address1}
        label="住所"
        required
        maxLength={200}
        {...(disabled === undefined ? {} : { disabled })}
      />
    </FieldGroup>
  );
};
