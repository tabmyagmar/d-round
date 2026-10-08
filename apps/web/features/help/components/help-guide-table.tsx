"use client";

import { Download, File } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";

import type { HelpGuide } from "@/features/help/utils/help-guides";

const helper = createDataTableColumns<HelpGuide>();

/** The legacy columns: 資料, バージョン, 更新日付, アクション (ダウンロード opens the PDF in a new tab). */
const columns = helper.columns([
  helper.accessor("name", {
    header: "資料",
    cell: ({ getValue }) => (
      <span className="flex items-center gap-3 font-medium">
        <File aria-hidden className="size-4 text-primary" />
        {getValue()}
      </span>
    ),
  }),
  helper.accessor("version", { header: "バージョン" }),
  helper.accessor("updatedAt", { header: "更新日付" }),
  helper.display({
    id: "actions",
    header: () => <span className="block text-right">アクション</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button
          size="sm"
          render={<a href={row.original.fileUrl} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          <Download data-icon="inline-start" />
          ダウンロード
        </Button>
      </div>
    ),
  }),
]);

export const HelpGuideTable = ({ guides }: { guides: readonly HelpGuide[] }) => (
  <DataTable
    title="ガイドブック"
    columns={columns}
    data={[...guides]}
    emptyMessage="資料がありません"
    getRowId={(guide) => guide.id}
  />
);
