"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import type { DefaultValues } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { Stepper } from "@repo/ui/components/composed/stepper";
import { StickyBar } from "@repo/ui/components/composed/sticky-bar";
import { FormActions } from "@repo/ui/components/form";
import { useStepper } from "@repo/ui/hooks/use-stepper";
import { clientFormSchema } from "@repo/validation";
import type { ClientFormValues, CreateClientInput } from "@repo/validation";

import type { AddressParts } from "@/components/source/address-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { ClientBasicStep } from "@/features/clients/components/form/client-basic-step";
import { ClientFormConfirm } from "@/features/clients/components/form/client-form-confirm";
import type { ChargerChoice } from "@/features/clients/types";
import { toClientInput } from "@/features/clients/utils/client-form-input";
import { CLIENT_NUMBER_TAKEN } from "@/features/clients/utils/client-labels";
import { CLIENT_STEP_FIELDS, CLIENT_STEP_LABELS } from "@/features/clients/utils/client-steps";

export type ClientFormProps = {
  /** クライアント情報登録 or クライアント情報編集: the card's title. */
  title: string;
  defaultValues: DefaultValues<ClientFormValues>;
  hierarchy: SourceHierarchy;
  /** The 担当者 on offer: every active user (legacy chargerUsers), plus an edited client's own. */
  chargerOptions: readonly ChargerChoice[];
  chargersLoading: boolean;
  findAddress: (postCode: string) => Promise<AddressParts | null>;
  /** Asked before 確認 (legacy useValidateEntityNumber); a taken number stays on the field. */
  isNumberFree: (number: number) => Promise<boolean>;
  cancelHref: string;
  /** 追加 or 保存, on the confirm step. */
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (input: CreateClientInput) => void;
};

/**
 * The client form, create and edit, as the legacy ClientForm: 基本情報 → 確認 on one schema, as the
 * staff form. 次へ validates the fields and the クライアント番号; the confirm step sends the form.
 */
export const ClientForm = ({
  title,
  defaultValues,
  hierarchy,
  chargerOptions,
  chargersLoading,
  findAddress,
  isNumberFree,
  cancelHref,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
}: ClientFormProps) => {
  // 次へ validates through `trigger`, never a submit, so the form re-validates each change itself
  // and a corrected field loses its error at once (the legacy ClientForm's `mode: 'onChange'`).
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues,
    mode: "onChange",
  });
  const stepper = useStepper<ClientFormValues>({ steps: CLIENT_STEP_FIELDS });

  // How many clicks the submit button's last click counted: a click that is part of a double
  // click never moves on or saves, else its second click lands on the button the first one
  // relabelled (次へ → 追加) and sends the form unseen. Enter counts none.
  const submitClicksRef = useRef(0);

  const isFree = async () => {
    if (await isNumberFree(form.getValues("number"))) {
      return true;
    }
    form.setError(
      "number",
      { type: "manual", message: CLIENT_NUMBER_TAKEN },
      { shouldFocus: true },
    );
    return false;
  };

  return (
    <form
      noValidate
      className="flex flex-1 flex-col gap-6"
      onClickCapture={(event) => {
        submitClicksRef.current =
          event.target instanceof Element && event.target.closest('button[type="submit"]')
            ? event.detail
            : 0;
      }}
      onSubmit={(event) => {
        const clicks = submitClicksRef.current;
        submitClicksRef.current = 0;
        if (clicks > 1) {
          event.preventDefault();
          return;
        }
        if (stepper.isLast) {
          void form.handleSubmit(
            (values) => {
              onSubmit(toClientInput(values));
            },
            // Not expected after the first step was checked; shows it with its errors.
            () => {
              stepper.goTo(0);
            },
          )(event);
          return;
        }
        event.preventDefault();
        void stepper.goNext(form.trigger, isFree);
      }}
    >
      <Stepper
        steps={CLIENT_STEP_LABELS}
        current={stepper.current}
        onStepClick={stepper.goTo}
        label="入力ステップ"
        className="mx-auto w-full max-w-4xl"
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {stepper.isFirst ? (
          <ClientBasicStep
            control={form.control}
            title={title}
            hierarchy={hierarchy}
            chargerOptions={chargerOptions}
            chargersLoading={chargersLoading}
            findAddress={findAddress}
          />
        ) : (
          <ClientFormConfirm
            title={title}
            values={form.getValues()}
            hierarchy={hierarchy}
            chargers={chargerOptions}
          />
        )}
      </div>
      <StickyBar>
        <FormActions
          className="mx-auto w-full max-w-4xl"
          submitLabel={stepper.isLast ? submitLabel : "次へ"}
          pendingLabel={pendingLabel}
          pending={pending}
        >
          {stepper.isFirst ? (
            <Button variant="outline" render={<Link href={cancelHref} />} nativeButton={false}>
              キャンセル
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={stepper.goPrev}>
              戻る
            </Button>
          )}
        </FormActions>
      </StickyBar>
    </form>
  );
};
