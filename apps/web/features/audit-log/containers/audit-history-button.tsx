"use client";

import { History } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Can } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import type { AuditEntityType } from "@repo/validation";

// Loaded when 変更履歴 is pressed, not with the detail page.
const AuditHistoryDialog = dynamic(
  () =>
    import("@/features/audit-log/components/history/audit-history-dialog").then(
      (module) => module.AuditHistoryDialog,
    ),
  { ssr: false },
);

export type AuditHistoryButtonProps = {
  entityType: AuditEntityType;
  entityId: string;
};

/**
 * 「変更履歴」 beside a detail page's actions, for those who may read the audit log (ADR 0015); the
 * page hands it to its detail container, as it hands in another feature's cards.
 */
export const AuditHistoryButton = ({ entityType, entityId }: AuditHistoryButtonProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Can I="read" a="AuditLog">
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <History data-icon="inline-start" />
        変更履歴
      </Button>
      {open ? (
        <AuditHistoryDialog entityType={entityType} entityId={entityId} onOpenChange={setOpen} />
      ) : null}
    </Can>
  );
};
