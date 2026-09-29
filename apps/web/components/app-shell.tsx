"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AbilityProvider } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import type { Role } from "@repo/validation";

import { RoleBadge } from "@/features/users/role-badge";
import { authClient } from "@/lib/auth/client";
import type { CurrentUser } from "@/lib/auth/server";
import { brand } from "@/lib/brand";

type NavItem = { href: string; label: string; hideFor?: readonly Role[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users", hideFor: ["member"] },
  { href: "/profile", label: "Profile" },
];

export const AppShell = ({ user, children }: { user: CurrentUser; children: ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <AbilityProvider user={{ id: user.id, role: user.role }}>
      <div className="flex min-h-svh flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3">
            <Link href="/dashboard" className="font-heading font-semibold tracking-tight">
              {brand.name}
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.filter((item) => !item.hideFor?.includes(user.role)).map((item) => (
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
