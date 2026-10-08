"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { DefaultValues } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Stepper } from "@repo/ui/components/composed/stepper";
import { StickyBar } from "@repo/ui/components/composed/sticky-bar";
import { FormActions } from "@repo/ui/components/form";
import { useStepper } from "@repo/ui/hooks/use-stepper";
import { staffFormSchema } from "@repo/validation";
import type { CreateStaffInput, StaffFormValues } from "@repo/validation";

import type { AddressParts } from "@/components/source/address-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { StaffBasicStep } from "@/features/staff/components/form/staff-basic-step";
import { StaffFamilyMemberFields } from "@/features/staff/components/form/staff-family-member-fields";
import { StaffFormConfirm } from "@/features/staff/components/form/staff-form-confirm";
import { StaffMemoFields } from "@/features/staff/components/form/staff-memo-fields";
import type { ChargerChoice, ChargerOption, MemoTemplate } from "@/features/staff/types";
import { toStaffInput } from "@/features/staff/utils/staff-form-input";
import { STAFF_NUMBER_TAKEN } from "@/features/staff/utils/staff-labels";
import {
  STAFF_STEP_FIELDS,
  STAFF_STEP_LABELS,
  stepOfErrors,
} from "@/features/staff/utils/staff-steps";

export type StaffFormProps = {
  /** スタッフ情報登録 or スタッフ情報編集: the first card's title. */
  title: string;
  defaultValues: DefaultValues<StaffFormValues>;
  hierarchy: SourceHierarchy;
  /** The 担当者 who cover these regions (`user.chargerOptions`). */
  findChargers: (regionCodes: number[]) => Promise<ChargerOption[]>;
  /** An edited staff's current 担当者: kept on offer whatever the regions, never dropped unasked. */
  storedChargers?: readonly ChargerChoice[];
  findAddress: (postCode: string) => Promise<AddressParts | null>;
  /** Asked before step 2 (legacy useValidateEntityNumber); a taken number stays on the field. */
  isEmployeeNumberFree: (employeeNumber: number) => Promise<boolean>;
  templates: readonly MemoTemplate[];
  cancelHref: string;
  /** 追加 or 保存, on the confirm step. */
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  errorMessage?: string | undefined;
  onSubmit: (input: CreateStaffInput) => void;
};

/**
 * The staff form, create and edit, as the legacy StaffForm: 基本情報 → 家族情報・メモ → 確認 on one
 * schema (plan decision 11). 次へ validates the step's fields (and, on step 1, the スタッフ番号);
 * the confirm step sends the whole form. The 担当者 offered follow the chosen regions, looked up
 * here because they depend on the form's own values.
 */
export const StaffForm = ({
  title,
  defaultValues,
  hierarchy,
  findChargers,
  storedChargers = [],
  findAddress,
  isEmployeeNumberFree,
  templates,
  cancelHref,
  submitLabel,
  pendingLabel,
  pending,
  errorMessage,
  onSubmit,
}: StaffFormProps) => {
  const form = useForm<StaffFormValues>({ resolver: zodResolver(staffFormSchema), defaultValues });
  const stepper = useStepper<StaffFormValues>({ steps: STAFF_STEP_FIELDS });
  const regionCodes = useWatch({ control: form.control, name: "regionCodes" });
  const chargers = useQuery({
    queryKey: ["staff-form", "chargers", regionCodes],
    queryFn: () => findChargers(regionCodes),
    enabled: regionCodes.length > 0,
  });
  const offered = regionCodes.length > 0 ? (chargers.data ?? []) : [];
  const chargerOptions = [
    ...offered,
    ...storedChargers.filter((stored) => !offered.some((charger) => charger.id === stored.id)),
  ];

  // How many clicks the submit button's last click counted: a click that is part of a double
  // click never moves on or saves, else its second click lands on the button the first one
  // relabelled (次へ → 追加) and sends the form unseen. Enter counts none.
  const submitClicksRef = useRef(0);

  const isNumberFree = async () => {
    if (await isEmployeeNumberFree(form.getValues("employeeNumber"))) {
      return true;
    }
    form.setError(
      "employeeNumber",
      { type: "manual", message: STAFF_NUMBER_TAKEN },
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
              onSubmit(toStaffInput(values));
            },
            // Not expected after the steps were checked; shows the first step with an error.
            (errors) => {
              stepper.goTo(stepOfErrors(Object.keys(errors)));
            },
          )(event);
          return;
        }
        event.preventDefault();
        void stepper.goNext(form.trigger, stepper.isFirst ? isNumberFree : undefined);
      }}
    >
      <Stepper
        steps={STAFF_STEP_LABELS}
        current={stepper.current}
        onStepClick={stepper.goTo}
        label="入力ステップ"
        className="w-full max-w-4xl"
      />
      <div className="flex w-full max-w-4xl flex-col gap-6">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>スタッフを保存できませんでした</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {stepper.current === 0 ? (
          <StaffBasicStep
            control={form.control}
            title={title}
            hierarchy={hierarchy}
            chargerOptions={chargerOptions}
            chargersReady={regionCodes.length === 0 || chargers.isSuccess}
            chargersLoading={chargers.isFetching}
            findAddress={findAddress}
          />
        ) : null}
        {stepper.current === 1 ? (
          <>
            <StaffFamilyMemberFields control={form.control} />
            <StaffMemoFields control={form.control} templates={templates} />
          </>
        ) : null}
        {stepper.current === 2 ? (
          <StaffFormConfirm
            title={title}
            values={form.getValues()}
            hierarchy={hierarchy}
            chargers={chargerOptions}
          />
        ) : null}
      </div>
      <StickyBar>
        <FormActions
          className="max-w-4xl"
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
