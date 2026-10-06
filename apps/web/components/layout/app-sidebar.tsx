"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useAbility } from "@repo/permissions/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/components/sidebar";

import { NavMain } from "@/components/layout/nav-main";
import { visibleNavGroups } from "@/config/nav";
import { href, LANDING_ROUTE } from "@/config/routes";
import { brand } from "@/lib/brand";

/**
 * The sidebar: the logo linking to the landing page next to the trigger (on the icon rail only the
 * trigger remains), then the menu this ability may see. The user menu lives in the header.
 */
export const AppSidebar = () => {
  const ability = useAbility();
  const pathname = usePathname();
  const groups = useMemo(() => visibleNavGroups(ability), [ability]);
  const { setOpenMobile } = useSidebar();

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
        {/* Toggles the icon rail on desktop and closes the sheet on mobile. */}
        <SidebarTrigger />
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
