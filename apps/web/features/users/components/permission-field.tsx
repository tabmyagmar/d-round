"use client";

import { Settings } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { FormFieldShell } from "@repo/ui/components/form";
import type { Role } from "@repo/validation";

// The dialog (and the catalog query inside it) loads when the button is pressed.
const PermissionDialog = dynamic(
  () =>
    import("@/features/users/components/permission-dialog").then(
      (module) => module.PermissionDialog,
    ),
  { ssr: false },
);

export type PermissionFieldProps = {
  role: Role;
  /** Selected child permission keys; `undefined` means the account type's permissions. */
  value: readonly string[] | undefined;
  onChange: (keys: string[]) => void;
  disabled?: boolean;
};

/** 権限（詳細設定）: a manager's permissions, adjusted per user in a dialog (legacy behaviour). */
export const PermissionField = ({
  role,
  value,
  onChange,
  disabled = false,
}: PermissionFieldProps) => {
  const [open, setOpen] = useState(false);
  return (
    <FormFieldShell
      htmlFor="permission-settings"
      label="権限（詳細設定）"
      description={
        value === undefined
          ? "アカウントタイプの標準の権限"
          : `${String(value.length)}件の権限を個別に設定しています`
      }
      error={undefined}
    >
      <Button
        id="permission-settings"
        variant="outline"
        className="w-fit"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Settings data-icon="inline-start" />
        権限（詳細設定）
      </Button>
      {open ? (
        <PermissionDialog
          role={role}
          value={value}
          onSave={(keys) => {
            onChange(keys);
            setOpen(false);
          }}
          onOpenChange={setOpen}
        />
      ) : null}
    </FormFieldShell>
  );
};
