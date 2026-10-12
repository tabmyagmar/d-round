"use client";

import { ChevronDown, History, Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { GroupedCheckboxList } from "@repo/ui/components/composed/grouped-checkbox-list";
import { FormActions } from "@repo/ui/components/form";
import { CSV_EXPORT_MAX_ROWS, CSV_EXPORT_TOO_MANY } from "@repo/validation";

import type { CsvExportGroup } from "@/features/csv/utils/csv-export-content";

export type CsvExportFormProps = {
  /** The entity, as the info text names its list and rows (担当者一覧, 担当者). */
  label: string;
  /** Rows ticked in the list. */
  selectedCount: number;
  groups: readonly CsvExportGroup[];
  initial: readonly string[];
  pending: boolean;
  /** ダウンロード with the ticked values (`CSV_EXPORT_CONTENT[type].inputOf`). */
  onSubmit: (values: string[]) => void;
  onShowHistory: () => void;
};

/**
 * The download dialog's body (legacy `CsvDownloadInfo` and `DropdownMultiSelect`): the three
 * steps, red while no row is ticked, then one closed list per group with its select-all and the
 * count ticked, 履歴 and ダウンロード. More rows than one download takes is said at once.
 */
export const CsvExportForm = ({
  label,
  selectedCount,
  groups,
  initial,
  pending,
  onSubmit,
  onShowHistory,
}: CsvExportFormProps) => {
  const [values, setValues] = useState<string[]>([...initial]);
  const tooMany = selectedCount > CSV_EXPORT_MAX_ROWS;
  const mainGroup = groups[0];
  const noColumn =
    mainGroup !== undefined && !mainGroup.options.some((option) => values.includes(option.value));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div
        className={
          selectedCount === 0 || tooMany
            ? "flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm leading-relaxed text-destructive"
            : "flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-sm leading-relaxed text-accent-foreground"
        }
      >
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          1. {label}一覧から、ダウンロードしたい{label}を選択する。
          <br />
          2. リストからダウンロードしたい項目を選択する。
          <br />
          3. 「ダウンロード」ボタンを押す。
        </p>
      </div>
      <p className="text-sm">
        選択中: <span className="tabular-nums">{selectedCount}</span> 件
        {tooMany ? <span className="ml-2 text-destructive">{CSV_EXPORT_TOO_MANY}</span> : null}
      </p>
      <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
        {groups.map((group) => {
          const ticked = group.options.filter((option) => values.includes(option.value)).length;
          return (
            <Collapsible key={group.key} className="group/columns">
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-accent">
                <span className="font-medium">{group.label}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {ticked > 0 ? `${String(ticked)}選択中` : "選択"}
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
                  value={values.filter((value) =>
                    group.options.some((option) => option.value === value),
                  )}
                  onValueChange={(next) => {
                    setValues((previous) => [
                      ...previous.filter(
                        (value) => !group.options.some((option) => option.value === value),
                      ),
                      ...next,
                    ]);
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
        submitLabel="ダウンロード"
        pendingLabel="ダウンロード中…"
        pending={pending}
        disabled={selectedCount === 0 || tooMany || noColumn}
      >
        <Button type="button" variant="outline" onClick={onShowHistory}>
          <History data-icon="inline-start" />
          履歴
        </Button>
      </FormActions>
    </form>
  );
};
