"use client";

import { createDataTableColumns, DataTable } from "@repo/ui/components/composed/data-table";
import { formatDate } from "@repo/ui/components/form";

import type { StaffDetail } from "@/features/staff/types";
import { FAMILY_RELATION_LABELS } from "@/features/staff/utils/staff-labels";

type FamilyMember = StaffDetail["familyMembers"][number];

const helper = createDataTableColumns<FamilyMember>();

/** The legacy 家族情報 columns. */
const FAMILY_COLUMNS = helper.columns([
  helper.display({ id: "index", header: "#", cell: ({ row }) => row.index + 1 }),
  helper.accessor("lastName", { header: "姓" }),
  helper.accessor("firstName", { header: "名" }),
  helper.accessor("lastNameKana", { header: "セイ", cell: ({ getValue }) => getValue() ?? "—" }),
  helper.accessor("firstNameKana", { header: "メイ", cell: ({ getValue }) => getValue() ?? "—" }),
  helper.accessor("relation", {
    header: "続柄",
    cell: ({ getValue }) => {
      const relation = getValue();
      return relation ? FAMILY_RELATION_LABELS[relation] : "—";
    },
  }),
  helper.accessor("birthday", {
    header: "生年月日",
    cell: ({ getValue }) => {
      const birthday = getValue();
      return birthday ? formatDate(birthday, "ja-JP") : "—";
    },
  }),
]);

/** 家族情報, as the legacy StaffFamilyMembers table. */
export const StaffFamilyTable = ({
  familyMembers,
}: {
  familyMembers: StaffDetail["familyMembers"];
}) => (
  <DataTable
    title="家族情報"
    columns={FAMILY_COLUMNS}
    data={familyMembers}
    isLoading={false}
    emptyMessage="家族情報はありません"
    getRowId={(row) => row.id}
  />
);
