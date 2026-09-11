"use client";

import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { AppRouter } from "@repo/api/router";
import { Button } from "@repo/ui/components/button";
import { DataTable, createDataTableColumns } from "@repo/ui/components/composed/data-table";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { ROLES } from "@repo/validation";
import type { Role } from "@repo/validation";

import { ROLE_LABELS, RoleBadge } from "@/features/users/role-badge";
import { useTRPC } from "@/lib/trpc/react";

type UserRow = inferRouterOutputs<AppRouter>["user"]["list"]["items"][number];

const PER_PAGE = 20;
const ALL_ROLES = "all";

const roleItems = [
  { value: ALL_ROLES, label: "All roles" },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const helper = createDataTableColumns<UserRow>();

const columns = helper.columns([
  helper.accessor("name", {
    header: "Name",
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
  }),
  helper.accessor("email", {
    header: "Email",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
  }),
  helper.accessor("department", {
    header: "Department",
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  helper.accessor("role", {
    header: "Role",
    cell: ({ getValue }) => <RoleBadge role={getValue()} />,
  }),
  helper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" render={<Link href={`/users/${row.original.id}`} />}>
        Open
      </Button>
    ),
  }),
]);

export const UsersTable = () => {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>(ALL_ROLES);

  const query = useQuery(
    trpc.user.list.queryOptions({
      page,
      perPage: PER_PAGE,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(role === ALL_ROLES ? {} : { role: role as Role }),
    }),
  );

  const pagination = useMemo(
    () =>
      query.data
        ? {
            page: query.data.page,
            totalPages: query.data.totalPages,
            total: query.data.total,
            hasPrev: query.data.hasPrev,
            hasNext: query.data.hasNext,
            onPageChange: setPage,
            itemLabel: "user",
          }
        : undefined,
    [query.data],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name, email or employee code"
          className="max-w-xs"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          items={roleItems}
          value={role}
          onValueChange={(value) => {
            setRole(value ?? ALL_ROLES);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isError ? (
        <p className="text-sm text-destructive">Could not load users: {query.error.message}</p>
      ) : null}

      <DataTable
        columns={columns}
        data={query.data?.items}
        isLoading={query.isPending}
        emptyMessage="No users match."
        getRowId={(row) => row.id}
        {...(pagination ? { pagination } : {})}
      />
    </div>
  );
};
