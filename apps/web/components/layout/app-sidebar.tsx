"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAbility } from "@repo/permissions/react";
import { Button } from "@repo/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@repo/ui/components/sidebar";

import { NavMain } from "@/components/layout/nav-main";
import { visibleNavGroups } from "@/config/nav";
import { href, LANDING_ROUTE } from "@/config/routes";
import { brand } from "@/lib/brand";

/**
 * The sidebar: the logo linking to the landing page next to the collapse button (on the icon rail
 * only the button remains), then the menu this ability may see. The user menu lives in the header.
 */
export const AppSidebar = () => {
  const ability = useAbility();
  const pathname = usePathname();
  const groups = useMemo(() => visibleNavGroups(ability), [ability]);
  const { setOpenMobile, toggleSidebar, state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link
          href={href(LANDING_ROUTE)}
          className="flex min-w-0 items-center rounded-md outline-none group-data-[collapsible=icon]:hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={() => {
            setOpenMobile(false);
          }}
        >
          <Image
            src={brand.logo.src}
            width={brand.logo.width}
            height={brand.logo.height}
            alt={brand.name}
            priority
            className="h-9 w-auto dark:brightness-0 dark:invert"
          />
        </Link>
        {/* « / » as the legacy DoubleLeft / DoubleRight: collapses to the icon rail and expands it
            again on desktop, closes the sheet on mobile. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-primary hover:text-primary"
          aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
          onClick={toggleSidebar}
        >
          {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
        </Button>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavMain key={group.id} group={group} pathname={pathname} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
};
