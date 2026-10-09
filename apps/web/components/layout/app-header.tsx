"use client";

import { usePathname, useRouter } from "next/navigation";

import { SidebarTrigger } from "@repo/ui/components/sidebar";

import { PageTitle } from "@/components/layout/page-title";
import { UserMenu } from "@/components/layout/user-menu";
import { href, routes } from "@/config/routes";
import { authClient } from "@/lib/auth/client";
import type { CurrentUser } from "@/lib/auth/server";

/**
 * The shell header: the page title (the page's only `h1`, with its breadcrumb trail) and the user
 * menu on the right, whose ログアウト signs out here. Below `md` the sidebar is a sheet, so the
 * header carries its trigger; on desktop the trigger lives in the sidebar header.
 */
export const AppHeader = ({ user }: { user: CurrentUser }) => {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push(href(routes.auth.login));
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4 md:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <div className="min-w-0 flex-1">
        <PageTitle pathname={pathname} />
      </div>
      <UserMenu user={user} onSignOut={signOut} />
    </header>
  );
};
