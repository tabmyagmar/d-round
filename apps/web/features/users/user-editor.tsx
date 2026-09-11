"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { userSubject } from "@repo/permissions";
import { Can, useAbility } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ConfirmDialog } from "@repo/ui/components/composed/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ROLES, roleSchema } from "@repo/validation";

import { ProfileForm } from "@/features/users/profile-form";
import { ROLE_LABELS, RoleBadge } from "@/features/users/role-badge";
import { useTRPC } from "@/lib/trpc/react";

const roleItems = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

export const UserEditor = ({ userId }: { userId: string }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const ability = useAbility();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const user = useQuery(trpc.user.byId.queryOptions({ userId }));

  const changeRole = useMutation(
    trpc.user.changeRole.mutationOptions({
      onSuccess: async () => {
        toast.success("Role updated");
        await queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const deactivate = useMutation(
    trpc.user.deactivate.mutationOptions({
      onSuccess: async () => {
        toast.success("User deactivated");
        setConfirmOpen(false);
        await queryClient.invalidateQueries(trpc.user.pathFilter());
        router.push("/users");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  if (user.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (user.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load this user</AlertTitle>
        <AlertDescription>{user.error.message}</AlertDescription>
      </Alert>
    );
  }

  const subject = userSubject({ id: user.data.id, department: user.data.department });
  const canEdit = ability.can("update", subject);

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{user.data.name}</h1>
        <RoleBadge role={user.data.role} />
        <span className="text-sm text-muted-foreground">{user.data.email}</span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              {canEdit
                ? "Changes are saved to this user's profile."
                : "You can view but not edit this profile."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              key={user.data.updatedAt.toISOString()}
              userId={user.data.id}
              disabled={!canEdit}
              initial={{
                name: user.data.name,
                employeeCode: user.data.employeeCode,
                department: user.data.department,
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Can I="changeRole" a="User">
            <Card>
              <CardHeader>
                <CardTitle>Role</CardTitle>
                <CardDescription>The last active admin cannot be demoted.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  items={roleItems}
                  value={roleSchema.safeParse(user.data.role).success ? user.data.role : null}
                  onValueChange={(value) => {
                    const parsed = roleSchema.safeParse(value);
                    if (parsed.success && parsed.data !== user.data.role) {
                      changeRole.mutate({ userId: user.data.id, role: parsed.data });
                    }
                  }}
                  disabled={changeRole.isPending}
                >
                  <SelectTrigger className="w-full">
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
              </CardContent>
            </Card>
          </Can>

          <Can I="delete" a="User">
            <Card>
              <CardHeader>
                <CardTitle>Deactivate</CardTitle>
                <CardDescription>
                  Signs the user out everywhere and blocks future sign-ins. The account is kept for
                  the audit trail.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmOpen(true);
                  }}
                >
                  Deactivate user
                </Button>
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title={`Deactivate ${user.data.name}?`}
                  description="They are signed out immediately and can no longer sign in. This can only be undone in the database."
                  confirmLabel="Deactivate"
                  destructive
                  pending={deactivate.isPending}
                  onConfirm={() => {
                    deactivate.mutate({ userId: user.data.id });
                  }}
                />
              </CardContent>
            </Card>
          </Can>
        </div>
      </div>
    </>
  );
};
