"use client";

import { cn } from "cn";
import { useId } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "../checkbox";
import { Label } from "../label";

export type CheckboxGroupOption = {
  value: string;
  label: string;
  /** Short note after the label, e.g. "default". */
  hint?: ReactNode;
};

export type CheckboxGroup = {
  key: string;
  label: string;
  options: readonly CheckboxGroupOption[];
};

export type GroupedCheckboxListProps = {
  groups: readonly CheckboxGroup[];
  value: readonly string[];
  /** The selected values in group / option order. */
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
  /** Accessible name of a group's select-all checkbox. */
  selectAllLabel?: (group: CheckboxGroup) => string;
  className?: string;
};

const defaultSelectAllLabel = (group: CheckboxGroup): string => `All ${group.label}`;

/**
 * Checkboxes in labelled groups, each with a select-all box that shows "some" as indeterminate —
 * permission matrices, area / region pickers and other grouped multi-choices.
 */
export const GroupedCheckboxList = ({
  groups,
  value,
  onValueChange,
  disabled = false,
  selectAllLabel = defaultSelectAllLabel,
  className,
}: GroupedCheckboxListProps) => {
  const baseId = useId();
  const selected = new Set(value);
  const emit = (next: Set<string>) => {
    onValueChange(
      groups.flatMap((group) =>
        group.options.map((option) => option.value).filter((item) => next.has(item)),
      ),
    );
  };
  const toggle = (values: readonly string[], checked: boolean) => {
    const next = new Set(selected);
    for (const item of values) {
      if (checked) {
        next.add(item);
      } else {
        next.delete(item);
      }
    }
    emit(next);
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {groups.map((group) => {
        const values = group.options.map((option) => option.value);
        const count = values.filter((item) => selected.has(item)).length;
        const all = count > 0 && count === values.length;
        return (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`${baseId}-${group.key}`}
            className="flex flex-col gap-2"
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <Checkbox
                aria-label={selectAllLabel(group)}
                checked={all}
                indeterminate={count > 0 && !all}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  toggle(values, checked);
                }}
              />
              <span id={`${baseId}-${group.key}`}>{group.label}</span>
            </div>
            {group.options.map((option) => (
              <Label key={option.value} className="flex items-center gap-2 pl-6 font-normal">
                <Checkbox
                  checked={selected.has(option.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    toggle([option.value], checked);
                  }}
                />
                <span>{option.label}</span>
                {option.hint ? (
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                ) : null}
              </Label>
            ))}
          </div>
        );
      })}
    </div>
  );
};
