"use client";

import { Plus, Trash2 } from "lucide-react";
import { useController, useFieldArray } from "react-hook-form";
import type { Control } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { ContentCard } from "@repo/ui/components/composed/content-card";
import { TextareaField } from "@repo/ui/components/form";
import { STAFF_LIST_MAX } from "@repo/validation";
import type { StaffFormValues } from "@repo/validation";

import type { MemoTemplate } from "@/features/staff/types";
import { STAFF_MEMO_TYPE_LABELS } from "@/features/staff/utils/staff-labels";

type MemoRowProps = {
  control: Control<StaffFormValues>;
  index: number;
  label: string;
  templates: readonly MemoTemplate[];
  /** Only a memo the user added can be removed; the five fixed slots stay. */
  onRemove?: () => void;
};

/** One memo: its text, and a button per 定型文 that adds the template's text on a new line. */
const MemoRow = ({ control, index, label, templates, onRemove }: MemoRowProps) => {
  const { field } = useController({ control, name: `memos.${index}.content` });
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <TextareaField
          control={control}
          name={`memos.${index}.content`}
          label={label}
          placeholder="メモを入力してください。"
          rows={3}
          maxLength={2000}
          className="min-w-0 flex-1"
        />
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${label}を削除`}
            className="text-destructive"
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>
      {templates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const current = typeof field.value === "string" ? field.value : "";
                field.onChange(current ? `${current}\n${template.content}` : template.content);
              }}
            >
              {template.short}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
};

export type StaffMemoFieldsProps = {
  control: Control<StaffFormValues>;
  /** The caller's 定型文 for スタッフ (legacy useCommentTemplates). */
  templates: readonly MemoTemplate[];
};

/**
 * メモ, the legacy step 2's second card: the five fixed slots (スタッフメモ, 入退社情報, 住所変更,
 * 保険関係, その他) and the memos the user adds (メモ, removable), each with the 定型文 shortcuts.
 * Only memos with text are stored.
 */
export const StaffMemoFields = ({ control, templates }: StaffMemoFieldsProps) => {
  const { fields, append, remove } = useFieldArray({ control, name: "memos" });
  return (
    <ContentCard title="メモ" contentClassName="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {fields.map((memo, index) => (
          <MemoRow
            key={memo.id}
            control={control}
            index={index}
            label={`${String(index + 1)}. ${STAFF_MEMO_TYPE_LABELS[memo.memoType]}`}
            templates={templates}
            {...(memo.memoType === "CUSTOM"
              ? {
                  onRemove: () => {
                    remove(index);
                  },
                }
              : {})}
          />
        ))}
      </ol>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= STAFF_LIST_MAX}
          onClick={() => {
            append({ memoType: "CUSTOM", content: "" });
          }}
        >
          <Plus />
          メモを追加
        </Button>
      </div>
    </ContentCard>
  );
};
