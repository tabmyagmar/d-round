"use client";

import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";

import type { CsvImport } from "@/features/csv/types";

/**
 * 登録: the confirmed lines being imported, n / m as the worker counts them (D10). The legacy
 * had no progress at all: its toast said to come back after five minutes.
 */
export const CsvProgressStep = ({
  csvImport,
  onClose,
}: {
  csvImport: CsvImport;
  onClose: () => void;
}) => (
  <div className="flex flex-col gap-4">
    <div role="status" className="flex flex-col items-center gap-3 py-8 text-sm">
      <Spinner aria-hidden className="size-6 text-primary" />
      <p className="font-medium tabular-nums">
        登録中… {csvImport.processedCount} / {csvImport.selectedCount} 件
      </p>
      <progress
        aria-label="登録の進み具合"
        value={csvImport.processedCount}
        max={Math.max(csvImport.selectedCount, 1)}
        className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
      />
      <p className="text-xs text-muted-foreground">
        このまま閉じても登録は続きます。履歴から確認できます。
      </p>
    </div>
    <div className="flex justify-end">
      <Button variant="outline" onClick={onClose}>
        閉じる
      </Button>
    </div>
  </div>
);
