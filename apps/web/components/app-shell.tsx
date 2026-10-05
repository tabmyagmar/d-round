"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { canUnscoped } from "@repo/permissions";
import type { AppAbility } from "@repo/permissions";
import { AbilityProvider, useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";

import { RoleBadge } from "@/features/users/role-badge";
import { authClient } from "@/lib/auth/client";
import type { CurrentUser } from "@/lib/auth/server";
import { brand } from "@/lib/brand";

export type NavItem = {
  href: string;
  label: string;
  /** Shown only when the ability allows it; the API re-checks on every request regardless. */
  visibleWhen?: (ability: AppAbility) => boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    href: "/users",
    label: "Users",
    visibleWhen: (ability) => canUnscoped(ability, "read", "User"),
  },
  { href: "/profile", label: "Profile" },
];

/** The nav entries the given ability may see, in display order. Pure — tested without a DOM. */
export const visibleNavItems = (ability: AppAbility): NavItem[] =>
  NAV.filter((item) => item.visibleWhen?.(ability) ?? true);

/** Rendered inside `AbilityProvider`, so the hook sees the signed-in user's ability. */
const AppNav = () => {
  const pathname = usePathname();
  const ability = useAbility();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {visibleNavItems(ability).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
            pathname.startsWith(item.href) && "bg-muted text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export const AppShell = ({ user, children }: { user: CurrentUser; children: ReactNode }) => {
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <AbilityProvider user={user}>
      <div className="flex min-h-svh flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3">
            <Link href="/dashboard" className="font-heading font-semibold tracking-tight">
              {brand.name}
            </Link>
            <AppNav />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
              <RoleBadge role={user.role} />
              <Separator orientation="vertical" className="h-5" />
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
          {children}
        </main>
      </div>
    </AbilityProvider>
  );
};
