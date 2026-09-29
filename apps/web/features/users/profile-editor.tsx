"use client";

import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ProfileForm } from "@/features/users/profile-form";
import { useTRPC } from "@/lib/trpc/react";

export const ProfileEditor = () => {
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
    <Card className="max-w-xl">
      <CardContent>
        <ProfileForm key={me.data.updatedAt.toISOString()} initial={{ name: me.data.name }} />
      </CardContent>
    </Card>
  );
};
