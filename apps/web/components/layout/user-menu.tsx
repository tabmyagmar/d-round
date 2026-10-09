"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { href, routes } from "@/config/routes";
import { RoleBadge } from "@/features/users/components/role-badge";
import type { CurrentUser } from "@/lib/auth/server";

// Loaded when ログアウト is chosen.
const ConfirmDialog = dynamic(
  () =>
    import("@repo/ui/components/composed/confirm-dialog").then((module) => module.ConfirmDialog),
  { ssr: false },
);

/** "Taro Yamada" → "TY", "山田 太郎" → "山太", one word → its first character, blank → "?". */
const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase() || "?";

export type UserMenuProps = {
  user: CurrentUser;
  /** Signs out and leaves the page; the header owns it. */
  onSignOut: () => Promise<void>;
};

/**
 * The header's user menu: who is signed in, with プロフィール and ログアウト, which asks first
 * (legacy `ProfileModals`: ログアウト確認 / ログアウトしますか？ / はい / いいえ).
 */
export const UserMenu = ({ user, onSignOut }: UserMenuProps) => {
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="h-10 gap-2 px-1.5 md:px-2" />}
          aria-label={user.name}
        >
          <Avatar>
            <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate md:inline">{user.name}</span>
          <ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56" align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-2 px-1.5 py-1.5 font-normal text-foreground">
              <div className="grid text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <div>
                <RoleBadge role={user.role} />
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href={href(routes.profile)} />}>
              <UserRound />
              {routes.profile.title}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setConfirming(true);
              }}
            >
              <LogOut />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={setConfirming}
          title="ログアウト確認"
          description="ログアウトしますか？"
          confirmLabel="はい"
          cancelLabel="いいえ"
          pendingLabel="ログアウト中…"
          pending={signingOut}
          onConfirm={() => {
            setSigningOut(true);
            void onSignOut();
          }}
        />
      ) : null}
    </>
  );
};
