"use client";

import { ChevronDown, History, Info } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { GroupedCheckboxList } from "@repo/ui/components/composed/grouped-checkbox-list";
import { FormActions } from "@repo/ui/components/form";
import { createCsvExportSchema } from "@repo/validation";
import type { z } from "@repo/validation";

import type { CsvExportContent, CsvExportPicks } from "@/features/csv/utils/csv-export-content";

export type CsvExportFormProps = {
  /** The entity, as the info text names its list and rows (担当者一覧, 担当者). */
  label: string;
  /** The rows ticked in the list. */
  ids: readonly string[];
  /** The type's groups, its first picks and how they become the input. */
  content: CsvExportContent;
  pending: boolean;
  /** ダウンロード with an input `csvExport.create`'s schema accepts. */
  onSubmit: (input: z.input<typeof createCsvExportSchema>) => void;
  onShowHistory: () => void;
};

/**
 * The download dialog's body (legacy `CsvDownloadInfo` and `DropdownMultiSelect`): the three steps,
 * red while the input does not pass `createCsvExportSchema` — the API's own schema, which says why
 * (no row ticked, more than 500, no column) — then one closed list per group with its 全選択 and
 * the count ticked, and 履歴 / ダウンロード side by side.
 */
export const CsvExportForm = ({
  label,
  ids,
  content,
  pending,
  onSubmit,
  onShowHistory,
}: CsvExportFormProps) => {
  const [picks, setPicks] = useState<CsvExportPicks>(content.initial);
  const input = content.inputOf([...ids], picks);
  const checked = createCsvExportSchema.safeParse(input);
  const problem = checked.success ? null : (checked.error.issues[0]?.message ?? null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (checked.success) {
          onSubmit(input);
        }
      }}
    >
      <Alert
        variant={problem ? "destructive" : "default"}
        className={problem ? undefined : "border-transparent bg-accent text-accent-foreground"}
      >
        <Info aria-hidden />
        <AlertDescription className={problem ? undefined : "text-accent-foreground"}>
          <p>
            1. {label}一覧から、ダウンロードしたい{label}を選択する。
            <br />
            2. リストからダウンロードしたい項目を選択する。
            <br />
            3. 「ダウンロード」ボタンを押す。
          </p>
          {problem ? <p className="font-medium">{problem}</p> : null}
        </AlertDescription>
      </Alert>
      <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
        {content.groups.map((group) => {
          const ticked = picks[group.key] ?? [];
          return (
            <Collapsible key={group.key} className="group/columns">
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent">
                <span className="font-medium">{group.label}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {ticked.length > 0 ? `${String(ticked.length)}選択中` : "選択"}
                  <ChevronDown
                    aria-hidden
                    className="size-4 transition-transform group-data-open/columns:rotate-180"
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <GroupedCheckboxList
                  // The panel's own select-all reads 全選択, as the legacy's.
                  groups={[{ ...group, label: "全選択" }]}
                  value={ticked}
                  onValueChange={(next) => {
                    setPicks((previous) => ({ ...previous, [group.key]: next }));
                  }}
                  selectAllLabel={() => `${group.label}をすべて選択`}
                  className="rounded-md bg-muted/50 p-3"
                />
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      <FormActions
        className="*:flex-1"
        submitLabel="ダウンロード"
        pendingLabel="ダウンロード中…"
        pending={pending}
        disabled={!checked.success}
      >
        <Button type="button" variant="outline" onClick={onShowHistory}>
          <History data-icon="inline-start" />
          履歴
        </Button>
      </FormActions>
    </form>
  );
};
