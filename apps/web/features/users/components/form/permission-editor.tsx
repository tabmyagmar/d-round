"use client";

import { useMemo, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { GroupedCheckboxList } from "@repo/ui/components/composed/grouped-checkbox-list";

import type { PermissionCatalog } from "@/features/users/types";
import { toCheckboxGroups } from "@/features/users/utils/permission-catalog";

export type PermissionEditorProps = {
  catalog: PermissionCatalog;
  /** What the account type grants: marked 標準 and restored by 標準に戻す. */
  roleKeys: readonly string[];
  initial: readonly string[];
  /** The ticked keys, in catalog order. */
  onSave: (keys: string[]) => void;
  onCancel: () => void;
};

/** Ticks the permissions one user holds, grouped as the catalog groups them. Local until 保存. */
export const PermissionEditor = ({
  catalog,
  roleKeys,
  initial,
  onSave,
  onCancel,
}: PermissionEditorProps) => {
  const [selected, setSelected] = useState<readonly string[]>(initial);
  const groups = useMemo(() => toCheckboxGroups(catalog, roleKeys), [catalog, roleKeys]);

  return (
    <div className="flex flex-col gap-4">
      <GroupedCheckboxList
        className="max-h-[60vh] overflow-y-auto pr-1"
        groups={groups}
        value={selected}
        onValueChange={setSelected}
        selectAllLabel={(group) => `${group.label}をすべて選択`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setSelected(roleKeys);
          }}
        >
          標準に戻す
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            onClick={() => {
              const chosen = new Set(selected);
              onSave(
                catalog.flatMap((group) =>
                  group.children.map((child) => child.key).filter((key) => chosen.has(key)),
                ),
              );
            }}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  );
};
