"use client";

import { Button } from "@repo/ui/components/button";
import { LoadingState } from "@repo/ui/components/composed/loading-state";

import type { CsvImport } from "@/features/csv/types";

/**
 * 登録: the confirmed lines being imported, n / m as the worker counts them (D10). The legacy had
 * no progress at all: its toast said to come back after five minutes.
 */
export const CsvProgressStep = ({
  csvImport,
  onClose,
}: {
  csvImport: CsvImport;
  onClose: () => void;
}) => (
  <div className="flex flex-col gap-4">
    <LoadingState
      message={`登録中… ${String(csvImport.processedCount)} / ${String(csvImport.selectedCount)} 件。このまま閉じても登録は続きます。履歴から確認できます。`}
    />
    <div className="flex justify-end">
      <Button variant="outline" onClick={onClose}>
        閉じる
      </Button>
    </div>
  </div>
);
