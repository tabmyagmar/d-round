"use client";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Card, CardContent } from "@repo/ui/components/card";
import { ContentCard } from "@repo/ui/components/composed/content-card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { PasswordChangeForm } from "@/features/users/components/profile/password-change-form";
import { ProfileForm } from "@/features/users/components/profile/profile-form";
import { useTRPC } from "@/lib/trpc/react";

export const ProfileContainer = () => {
  const trpc = useTRPC();
  const me = useQuery(trpc.user.me.queryOptions());

  if (me.isPending) {
    return <Skeleton className="h-64 w-full max-w-xl" />;
  }
  if (me.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load your profile</AlertTitle>
        <AlertDescription>{me.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card>
        <CardContent>
          <ProfileForm
            key={me.data.updatedAt.toISOString()}
            initial={{
              lastName: me.data.lastName,
              firstName: me.data.firstName,
              lastNameKana: me.data.lastNameKana,
              firstNameKana: me.data.firstNameKana,
            }}
          />
        </CardContent>
      </Card>
      <ContentCard
        title="パスワード変更"
        description="変更すると、この端末以外のログインはすべて終了します。"
      >
        <PasswordChangeForm />
      </ContentCard>
    </div>
  );
};
