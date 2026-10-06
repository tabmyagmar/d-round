"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAbility } from "@repo/permissions/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@repo/ui/components/sidebar";

import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import { visibleNavGroups } from "@/config/nav";
import { href, LANDING_ROUTE } from "@/config/routes";
import type { CurrentUser } from "@/lib/auth/server";
import { brand } from "@/lib/brand";

/** The sidebar: brand link to the landing page, the menu this ability may see, the user menu. */
export const AppSidebar = ({ user }: { user: CurrentUser }) => {
  const ability = useAbility();
  const pathname = usePathname();
  const groups = useMemo(() => visibleNavGroups(ability), [ability]);
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={href(LANDING_ROUTE)} />}
              tooltip={brand.name}
              onClick={() => {
                setOpenMobile(false);
              }}
            >
              {/* The collapsed rail shows only this square, so it carries the brand's initial. */}
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
                {brand.name.slice(0, 1)}
              </div>
              <span className="font-heading font-semibold">{brand.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavMain key={group.id} group={group} pathname={pathname} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
