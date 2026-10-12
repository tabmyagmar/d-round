"use client";

import { Download, History, RefreshCw, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ReactNode } from "react";

import { canUnscoped } from "@repo/permissions";
import { useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import type { CsvImportType } from "@repo/validation";

import type { CsvEntity } from "@/features/csv/types";
import { CSV_ENTITIES } from "@/features/csv/utils/csv-entities";
import { useRowSelection } from "@/stores/row-selection";

// Each dialog loads when its item is chosen, not with the list.
const CsvImportDialog = dynamic(
  () =>
    import("@/features/csv/components/import/csv-import-dialog").then(
      (module) => module.CsvImportDialog,
    ),
  { ssr: false },
);
const CsvHistoryDialog = dynamic(
  () =>
    import("@/features/csv/components/history/csv-history-dialog").then(
      (module) => module.CsvHistoryDialog,
    ),
  { ssr: false },
);
const CsvExportDialog = dynamic(
  () =>
    import("@/features/csv/components/export/csv-export-dialog").then(
      (module) => module.CsvExportDialog,
    ),
  { ssr: false },
);
const CsvExportHistoryDialog = dynamic(
  () =>
    import("@/features/csv/components/export/csv-export-history-dialog").then(
      (module) => module.CsvExportHistoryDialog,
    ),
  { ssr: false },
);

/** 履歴, opened at the 追加 or 更新 list of a type. */
type CsvHistoryTarget = { kind: "history"; type?: CsvImportType };

/**
 * The dialog shown. One opened from another goes back to it when closed, as the legacy's nested
 * dialogs did (the detail's 戻る returned to 履歴; ダウンロード履歴 closed onto the download).
 */
type CsvMenuTarget =
  | { kind: "import"; type: CsvImportType; csvImportId?: string; back?: CsvHistoryTarget }
  | CsvHistoryTarget
  | { kind: "export" }
  | { kind: "export-history"; back?: { kind: "export" } };

type CsvMenuItem = { key: string; label: string; icon: ReactNode; target: CsvMenuTarget };

/**
 * A list's 「CSV」 menu (legacy `CsvMenus` and the toolbar's download button, D13), offering what
 * the services allow (D11): ダウンロード of the ticked rows and 履歴 for those who may download
 * (catalog 1402) and read every row of the entity; {label}を追加 and {label}を更新 for those who
 * may also upload CSV files (1401) and write every row — following an import reads it as 履歴
 * does. Nothing allowed, no menu. Below `md` the items open in a drawer from the bottom, as
 * `FilterPopover`'s fields (D14). Rendered inside the list's `RowSelectionProvider`.
 */
export const CsvMenu = ({ entity }: { entity: CsvEntity }) => {
  const ability = useAbility();
  const content = CSV_ENTITIES[entity];
  const rowSelection = useRowSelection((store) => store.rowSelection);
  const [target, setTarget] = useState<CsvMenuTarget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const mayDownload =
    ability.can("read", "SourceCsvHistory") && canUnscoped(ability, "read", content.subject);
  const mayUpload = mayDownload && ability.can("create", "SourceCsvHistory");

  const items: CsvMenuItem[] = [];
  if (mayUpload && canUnscoped(ability, "create", content.subject)) {
    items.push({
      key: "create",
      label: `${content.label}を追加`,
      icon: <Upload />,
      target: { kind: "import", type: content.createType },
    });
  }
  if (mayUpload && canUnscoped(ability, "update", content.subject)) {
    items.push({
      key: "update",
      label: `${content.label}を更新`,
      icon: <RefreshCw />,
      target: { kind: "import", type: content.updateType },
    });
  }
  if (mayDownload) {
    items.push(
      { key: "export", label: "ダウンロード", icon: <Download />, target: { kind: "export" } },
      { key: "history", label: "履歴", icon: <History />, target: { kind: "history" } },
    );
  }
  if (items.length === 0) {
    return null;
  }

  const closeDialog = (open: boolean) => {
    if (!open) {
      setTarget(target && "back" in target ? (target.back ?? null) : null);
    }
  };

  return (
    <>
      {isMobile ? (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger render={<Button variant="outline" />}>CSV</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>CSV</DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-1 p-4 pb-6">
              {items.map((item) => (
                <Button
                  key={item.key}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setDrawerOpen(false);
                    setTarget(item.target);
                  }}
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>CSV</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={() => {
                  setTarget(item.target);
                }}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {target?.kind === "import" ? (
        <CsvImportDialog
          key={target.csvImportId ?? target.type}
          entity={entity}
          type={target.type}
          {...(target.csvImportId === undefined ? {} : { csvImportId: target.csvImportId })}
          onOpenChange={closeDialog}
        />
      ) : null}
      {target?.kind === "history" ? (
        <CsvHistoryDialog
          entity={entity}
          {...(target.type === undefined ? {} : { initialType: target.type })}
          onOpenChange={closeDialog}
          onOpenImport={(type, csvImportId) => {
            setTarget({ kind: "import", type, csvImportId, back: { kind: "history", type } });
          }}
        />
      ) : null}
      {target?.kind === "export" ? (
        <CsvExportDialog
          entity={entity}
          ids={Object.keys(rowSelection)}
          onOpenChange={closeDialog}
          onShowHistory={() => {
            setTarget({ kind: "export-history", back: { kind: "export" } });
          }}
        />
      ) : null}
      {target?.kind === "export-history" ? (
        <CsvExportHistoryDialog entity={entity} onOpenChange={closeDialog} />
      ) : null}
    </>
  );
};
