"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { DefaultValues } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { Stepper } from "@repo/ui/components/composed/stepper";
import { StickyBar } from "@repo/ui/components/composed/sticky-bar";
import { FormActions } from "@repo/ui/components/form";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import { useStepper } from "@repo/ui/hooks/use-stepper";
import { branchFormSchema } from "@repo/validation";
import type { BranchFormValues, CreateBranchInput } from "@repo/validation";

import type { AddressParts } from "@/components/source/address-fields";
import type { SourceHierarchy } from "@/components/source/hierarchy-options";
import { BranchBasicStep } from "@/features/branches/components/form/branch-basic-step";
import { BranchFormConfirm } from "@/features/branches/components/form/branch-form-confirm";
import type { ChargerChoice, ClientOption } from "@/features/branches/types";
import { toBranchInput } from "@/features/branches/utils/branch-form-input";
import { BRANCH_STEP_FIELDS, BRANCH_STEP_LABELS } from "@/features/branches/utils/branch-steps";

export type BranchFormProps = {
  /** 就業先部署登録 or 就業先部署編集: the first card's title. */
  title: string;
  defaultValues: DefaultValues<BranchFormValues>;
  hierarchy: SourceHierarchy;
  /** The clients matching a search (`client.options`: first 20 by reading). */
  findClients: (search: string) => Promise<ClientOption[]>;
  /** An edited branch's client: kept on offer, so it is named whatever the search returns. */
  storedClient?: ClientOption;
  /** The chosen client's next 就業先番号 (legacy nextBranchNumber); create only. */
  findNextNumber?: (clientId: string) => Promise<number>;
  /** The 担当者 on offer: every active user (legacy chargerUsers), plus an edited branch's own. */
  chargerOptions: readonly ChargerChoice[];
  chargersLoading: boolean;
  findAddress: (postCode: string) => Promise<AddressParts | null>;
  cancelHref: string;
  /** 追加 or 保存, on the confirm step. */
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  onSubmit: (input: CreateBranchInput) => void;
};

/**
 * The branch form, create and edit, as the legacy BranchForm: 基本情報 → 確認 on one schema, as the
 * client form. The clients come from a server search (the picker's typed text, debounced) and, on
 * create, choosing one fills 就業先番号 with its next number, as the legacy did; looked up here
 * because they depend on the form's own values. A 就業先番号 the client already uses is refused on
 * save (the legacy had no pre-check).
 */
export const BranchForm = ({
  title,
  defaultValues,
  hierarchy,
  findClients,
  storedClient,
  findNextNumber,
  chargerOptions,
  chargersLoading,
  findAddress,
  cancelHref,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
}: BranchFormProps) => {
  // 次へ validates through `trigger`, never a submit, so the form re-validates each change itself
  // and a corrected field loses its error at once (the legacy BranchForm's `mode: 'onChange'`).
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues,
    mode: "onChange",
  });
  const stepper = useStepper<BranchFormValues>({ steps: BRANCH_STEP_FIELDS });

  const [clientSearch, setClientSearch] = useState("");
  const searchClients = useDebouncedCallback(setClientSearch);
  const clients = useQuery({
    queryKey: ["branch-form", "clients", clientSearch],
    queryFn: () => findClients(clientSearch),
    placeholderData: keepPreviousData,
  });
  const found = clients.data ?? [];
  const clientOptions =
    storedClient && !found.some((client) => client.id === storedClient.id)
      ? [...found, storedClient]
      : found;

  const clientId = useWatch({ control: form.control, name: "clientId" });
  const nextNumber = useQuery({
    queryKey: ["branch-form", "next-number", clientId],
    queryFn: async () => (await findNextNumber?.(clientId)) ?? null,
    enabled: findNextNumber !== undefined && clientId !== "",
    staleTime: 0,
  });
  const { setValue } = form;
  useEffect(() => {
    if (typeof nextNumber.data === "number") {
      setValue("number", nextNumber.data, { shouldDirty: true, shouldValidate: true });
    }
  }, [nextNumber.data, setValue]);

  // How many clicks the submit button's last click counted: a click that is part of a double
  // click never moves on or saves, else its second click lands on the button the first one
  // relabelled (次へ → 追加) and sends the form unseen. Enter counts none.
  const submitClicksRef = useRef(0);

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
              onSubmit(toBranchInput(values));
            },
            // Not expected after the first step was checked; shows it with its errors.
            () => {
              stepper.goTo(0);
            },
          )(event);
          return;
        }
        event.preventDefault();
        void stepper.goNext(form.trigger);
      }}
    >
      <Stepper
        steps={BRANCH_STEP_LABELS}
        current={stepper.current}
        onStepClick={stepper.goTo}
        label="入力ステップ"
        className="mx-auto w-full max-w-4xl"
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {stepper.isFirst ? (
          <BranchBasicStep
            control={form.control}
            title={title}
            hierarchy={hierarchy}
            clientOptions={clientOptions}
            clientsLoading={clients.isFetching}
            onClientSearch={searchClients}
            chargerOptions={chargerOptions}
            chargersLoading={chargersLoading}
            findAddress={findAddress}
          />
        ) : (
          <BranchFormConfirm
            title={title}
            values={form.getValues()}
            hierarchy={hierarchy}
            clientName={clientOptions.find((client) => client.id === clientId)?.name ?? clientId}
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
