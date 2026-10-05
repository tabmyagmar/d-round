"use client";

import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/sidebar";

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

/** Avatar, name and email — the menu button and the menu label show the same block. */
const UserSummary = ({ user }: { user: CurrentUser }) => (
  <>
    <Avatar>
      <AvatarFallback>{initialsOf(user.name)}</AvatarFallback>
    </Avatar>
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
    </div>
  </>
);

/** The sidebar footer: who is signed in, with プロフィール and ログアウト. */
export const NavUser = ({ user }: { user: CurrentUser }) => {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  const signOut = async () => {
    await authClient.signOut();
    router.push(href(routes.auth.login));
    router.refresh();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <UserSummary user={user} />
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-2 px-1 py-1.5 font-normal text-foreground">
                <div className="flex items-center gap-2">
                  <UserSummary user={user} />
                </div>
                <div>
                  <RoleBadge role={user.role} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href={href(routes.profile)} />}
                onClick={() => {
                  setOpenMobile(false);
                }}
              >
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
