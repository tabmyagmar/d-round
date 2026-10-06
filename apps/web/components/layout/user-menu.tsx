"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { RoleBadge } from "@/features/users/role-badge";
import { authClient } from "@/lib/auth/client";
import type { CurrentUser } from "@/lib/auth/server";

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

/** The header's user menu: who is signed in, with プロフィール and ログアウト. */
export const UserMenu = ({ user }: { user: CurrentUser }) => {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push(href(routes.auth.login));
    router.refresh();
  };

  return (
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
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
