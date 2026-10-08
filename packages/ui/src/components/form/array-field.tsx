"use client";

import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useFieldArray, useFormState } from "react-hook-form";
import type { ArrayPath, Control, FieldArray, FieldPath, FieldValues } from "react-hook-form";

import { Button } from "../button";
import { FieldDescription, FieldError, FieldSet } from "../field";

import { FormFieldLabel } from "./form-field-label";

export type ArrayFieldRow = {
  index: number;
  /** Stable key from `useFieldArray`; use it for nested field names: `` `${name}.${index}.qty` ``. */
  id: string;
  isFirst: boolean;
  isLast: boolean;
  remove: () => void;
};

export type ArrayFieldProps<TValues extends FieldValues, TName extends ArrayPath<TValues>> = {
  control: Control<TValues>;
  name: TName;
  label: string;
  /** Keeps the label for assistive technology only (a card title already names the rows). */
  hideLabel?: boolean;
  description?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  className?: string;
  /** Renders the fields of one row; the row frame, move and remove buttons are provided. */
  renderRow: (row: ArrayFieldRow) => ReactNode;
  /** Value appended by the add button. */
  newItem: () => FieldArray<TValues, TName>;
  min?: number;
  max?: number;
  addLabel?: string;
  /** Show move up/down buttons. */
  sortable?: boolean;
  emptyMessage?: string;
};

/**
 * Repeating rows (line items, approvers, attachments) on top of `useFieldArray`. Row-level
 * validation errors render inside the row's own fields; array-level errors (min/max) below.
 */
export const ArrayField = <TValues extends FieldValues, TName extends ArrayPath<TValues>>({
  control,
  name,
  label,
  hideLabel = false,
  description,
  required,
  hint,
  disabled = false,
  className,
  renderRow,
  newItem,
  min = 0,
  max,
  addLabel = "行を追加",
  sortable = false,
  emptyMessage = "まだ行がありません",
}: ArrayFieldProps<TValues, TName>) => {
  const { fields, append, remove, move } = useFieldArray({ control, name });
  // An ArrayPath is always a valid Path; react-hook-form just does not express that relation.
  const path = name as unknown as FieldPath<TValues>;
  const formState = useFormState({ control, name: path });
  const { error } = control.getFieldState(path, formState);
  const rootMessage = error?.root?.message ?? error?.message;
  const canRemove = fields.length > min;
  const canAdd = max === undefined || fields.length < max;

  return (
    <FieldSet className={className}>
      <FormFieldLabel
        asLegend
        required={required}
        hint={hint}
        {...(hideLabel ? { className: "sr-only" } : {})}
      >
        {label}
      </FormFieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {fields.map((row, index) => (
            <li key={row.id} className="flex items-start gap-2 rounded-lg border p-3">
              <span className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {renderRow({
                  index,
                  id: row.id,
                  isFirst: index === 0,
                  isLast: index === fields.length - 1,
                  remove: () => {
                    remove(index);
                  },
                })}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {sortable ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="上へ"
                      disabled={disabled || index === 0}
                      onClick={() => {
                        move(index, index - 1);
                      }}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="下へ"
                      disabled={disabled || index === fields.length - 1}
                      onClick={() => {
                        move(index, index + 1);
                      }}
                    >
                      <ChevronDownIcon />
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="削除"
                  className="text-destructive"
                  disabled={disabled || !canRemove}
                  onClick={() => {
                    remove(index);
                  }}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canAdd}
          onClick={() => {
            append(newItem());
          }}
        >
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
      <FieldError errors={[rootMessage === undefined ? undefined : { message: rootMessage }]} />
    </FieldSet>
  );
};
