import type { ReactNode } from "react";

import { AbilityProvider } from "@repo/permissions/react";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { CurrentUser } from "@/lib/auth/server";

/**
 * The signed-in shell under /admin: ability for the whole tree, collapsible sidebar with the logo,
 * header with the page title and the user menu, and the page gutters (`--page-gutter`, which a
 * page's `StickyBar` reaches across). A server component — only the serialisable `user` crosses
 * into the client pieces; the nav (icons) is read on the client side.
 */
export const AppShell = ({
  user,
  defaultOpen,
  children,
}: {
  user: CurrentUser;
  /** From the `sidebar_state` cookie, so the first render matches the user's last choice. */
  defaultOpen: boolean;
  children: ReactNode;
}) => (
  <AbilityProvider user={user}>
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      {/* SidebarInset is the <main>; the page wrapper inside it is a <div>. */}
      <SidebarInset>
        <AppHeader user={user} />
        <div className="flex flex-1 flex-col gap-6 p-(--page-gutter) [--page-gutter:--spacing(4)] md:[--page-gutter:--spacing(6)]">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  </AbilityProvider>
);
