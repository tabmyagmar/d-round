"use client";

import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import { formatDate } from "@repo/ui/components/form";

import type { StaffDetail } from "@/features/staff/types";
import { chargersDuring } from "@/features/staff/utils/staff-chargers";

type JobHistory = StaffDetail["jobHistories"][number];

const helper = createDataTableColumns<JobHistory>();

/** The legacy 在籍情報 columns; 担当者 are those in charge during the period. */
const jobHistoryColumns = (chargers: StaffDetail["chargers"]) =>
  helper.columns([
    helper.display({ id: "index", header: "#", cell: ({ row }) => row.index + 1 }),
    helper.accessor("hireDate", {
      header: "入社日",
      cell: ({ getValue }) => formatDate(getValue(), "ja-JP"),
    }),
    helper.accessor("resignationDate", {
      header: "退職日",
      cell: ({ getValue }) => {
        const date = getValue();
        return date ? formatDate(date, "ja-JP") : "—";
      },
    }),
    helper.accessor("resignationReason", {
      header: "退職理由",
      cell: ({ getValue }) => (
        <span className="block max-w-64 whitespace-pre-wrap">{getValue() ?? "—"}</span>
      ),
    }),
    helper.display({
      id: "chargers",
      header: "担当者",
      cell: ({ row }) =>
        chargersDuring(chargers, row.original)
          .map((charger) => charger.user.name)
          .join("、") || "—",
    }),
  ]);

/** 在籍情報: the staff's employment periods, as the legacy StaffJobHistories table. */
export const StaffJobHistoryTable = ({ staff }: { staff: StaffDetail }) => {
  const columns = useMemo(() => jobHistoryColumns(staff.chargers), [staff.chargers]);
  return (
    <DataTable
      title="在籍情報"
      columns={columns}
      data={staff.jobHistories}
      isLoading={false}
      emptyMessage="在籍情報はありません"
      getRowId={(row) => row.id}
    />
  );
};
