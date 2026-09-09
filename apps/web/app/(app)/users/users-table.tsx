"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { ROLES } from "@repo/validation";
import type { Role } from "@repo/validation";

import { ROLE_LABELS, RoleBadge } from "@/components/role-badge";
import { useTRPC } from "@/lib/trpc/react";

const PER_PAGE = 20;
const ALL_ROLES = "all";

const roleItems = [
  { value: ALL_ROLES, label: "All roles" },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

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

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending
              ? Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : null}
            {query.data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>{user.department ?? "—"}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" render={<Link href={`/users/${user.id}`} />}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {query.data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {query.data ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {query.data.total} user{query.data.total === 1 ? "" : "s"} · page {query.data.page} of{" "}
            {Math.max(1, query.data.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!query.data.hasPrev}
              onClick={() => {
                setPage((current) => current - 1);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!query.data.hasNext}
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
