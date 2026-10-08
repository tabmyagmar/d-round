"use client";

import { Eye, FilePen, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";

import { useAbility } from "@repo/permissions/react";
import { RowActions } from "@repo/ui/components/composed/row-actions";
import type { RowAction } from "@repo/ui/components/composed/row-actions";

import { href, routes } from "@/config/routes";
import type { ClientRow } from "@/features/clients/types";

export type ClientRowActionsProps = {
  client: ClientRow;
  onChangeStatus: (client: ClientRow) => void;
  onDelete: (client: ClientRow) => void;
};

/**
 * The row's menu, by ability, in the order of the other ported lists: クライアント情報詳細,
 * クライアント情報編集, ステータス変更 (the legacy row's status select) and クライアント削除, which
 * stays disabled until the client is 停止 (legacy `isDeleteAble`).
 */
export const ClientRowActions = ({ client, onChangeStatus, onDelete }: ClientRowActionsProps) => {
  const ability = useAbility();

  const actions: RowAction[] = [
    ...(ability.can("read", "Client")
      ? [
          {
            key: "detail",
            label: "クライアント情報詳細",
            icon: <Eye />,
            render: <Link href={href(routes.client.detail, { id: client.id })} />,
          },
        ]
      : []),
    ...(ability.can("update", "Client")
      ? [
          {
            key: "edit",
            label: "クライアント情報編集",
            icon: <FilePen />,
            render: <Link href={href(routes.client.update, { id: client.id })} />,
          },
        ]
      : []),
    ...(ability.can("status", "Client")
      ? [
          {
            key: "status",
            label: "ステータス変更",
            icon: <RefreshCw />,
            onSelect: () => {
              onChangeStatus(client);
            },
          },
        ]
      : []),
    ...(ability.can("delete", "Client")
      ? [
          {
            key: "delete",
            label: "クライアント削除",
            icon: <Trash2 />,
            destructive: true,
            disabled: client.status !== "SUSPENDED",
            onSelect: () => {
              onDelete(client);
            },
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} label={`${client.name}の操作`} />;
};
