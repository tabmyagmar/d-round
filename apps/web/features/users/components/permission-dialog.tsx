"use client";

import { useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { ContentDialog } from "@repo/ui/components/composed/content-dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Role } from "@repo/validation";

import { PermissionEditor } from "@/features/users/components/permission-editor";
import { usePermissionCatalog } from "@/features/users/hooks/use-permission-catalog";
import { roleKeysOf } from "@/features/users/utils/permission-catalog";
import { ROLE_LABELS } from "@/features/users/utils/user-labels";

export type PermissionDialogProps = {
  role: Role;
  /** The selection so far; `undefined` starts from the account type's permissions. */
  value: readonly string[] | undefined;
  onSave: (keys: string[]) => void;
  onOpenChange: (open: boolean) => void;
};

/**
 * 権限（詳細設定）: fetches the catalog and edits one user's permissions. Mounted only while open
 * (`PermissionField` loads it with `next/dynamic`), so a form never loads the catalog it does not
 * show.
 */
export const PermissionDialog = ({ role, value, onSave, onOpenChange }: PermissionDialogProps) => {
  const catalog = usePermissionCatalog();
  const roleKeys = useMemo(
    () => (catalog.data ? roleKeysOf(catalog.data, role) : []),
    [catalog.data, role],
  );

  return (
    <ContentDialog
      open
      onOpenChange={onOpenChange}
      title="権限（詳細設定）"
      description={`${ROLE_LABELS[role]}の標準の権限から、この担当者だけ追加・削除できます。`}
    >
      {catalog.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : catalog.isError ? (
        <Alert variant="destructive">
          <AlertTitle>権限の一覧を読み込めませんでした</AlertTitle>
          <AlertDescription>{catalog.error.message}</AlertDescription>
        </Alert>
      ) : (
        <PermissionEditor
          catalog={catalog.data}
          roleKeys={roleKeys}
          initial={value ?? roleKeys}
          onSave={onSave}
          onCancel={() => {
            onOpenChange(false);
          }}
        />
      )}
    </ContentDialog>
  );
};
