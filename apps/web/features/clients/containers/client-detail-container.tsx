"use client";

import { useQuery } from "@tanstack/react-query";
import { FilePen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Can } from "@repo/permissions/react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { GeneralStatusBadge } from "@/components/general-status-badge";
import { href, routes } from "@/config/routes";
import { ClientInfoCard } from "@/features/clients/components/detail/client-info-card";
import { useTRPC } from "@/lib/trpc/react";

export type ClientDetailContainerProps = {
  clientId: string;
  /** 就業先部署情報, from the branches feature: the page composes the features. */
  branches?: ReactNode;
};

/**
 * クライアント情報詳細 (read-only, as the legacy ClientContainer): クライアント情報 on the left and
 * the client's 就業先部署 on the right. The legacy toolbar's 編集 sits beside the client's name; its
 * print and download buttons did nothing and are not carried over.
 */
export const ClientDetailContainer = ({ clientId, branches }: ClientDetailContainerProps) => {
  const trpc = useTRPC();
  const client = useQuery(trpc.client.byId.queryOptions({ clientId }));

  if (client.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (client.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>クライアント情報を読み込めませんでした</AlertTitle>
        <AlertDescription>{client.error.message}</AlertDescription>
      </Alert>
    );
  }

  const detail = client.data;
  return (
    <>
      {/* The header holds the page's h1 (the route title); the client shown here is an h2. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-heading text-xl font-semibold">{detail.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{detail.nameKana}</span>
            <GeneralStatusBadge status={detail.status} />
          </div>
        </div>
        <Can I="update" a="Client">
          <Button
            render={<Link href={href(routes.client.update, { id: detail.id })} />}
            nativeButton={false}
          >
            <FilePen data-icon="inline-start" />
            編集
          </Button>
        </Can>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ClientInfoCard client={detail} />
        </div>
        {branches ? <div className="min-w-0 lg:col-span-8">{branches}</div> : null}
      </div>
    </>
  );
};
