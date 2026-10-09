"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@repo/ui/components/sidebar";

import { isNavItemActive } from "@/config/nav";
import type { NavBranch, NavGroup, NavLeaf } from "@/config/nav";
import { href } from "@/config/routes";

/**
 * A row as in the legacy sidebar: 40 px, the full width of the sidebar, its icon 20 px; the
 * selected row is tinted with a 2 px bar in the brand colour on its right edge. The icon rail keeps
 * its 32 px squares.
 */
const ROW =
  "h-10 rounded-none px-4 data-active:border-r-2 data-active:border-sidebar-primary [&>svg:first-child]:size-5 group-data-[collapsible=icon]:p-1.5!";

// Every link closes the mobile sheet; on desktop `setOpenMobile(false)` changes nothing.
const NavLeafItem = ({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) => {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href(leaf.route)} />}
        isActive={isNavItemActive(pathname, leaf)}
        tooltip={leaf.route.title}
        className={ROW}
        onClick={() => {
          setOpenMobile(false);
        }}
      >
        <leaf.icon />
        <span>{leaf.route.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

/** A heading over links (マスター管理); opens whenever one of its children becomes the page. */
const NavBranchItem = ({ branch, pathname }: { branch: NavBranch; pathname: string }) => {
  const sidebar = useSidebar();
  const active = isNavItemActive(pathname, branch);
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);

  // The layout stays mounted across soft navigation, so the initial state alone never reopens the
  // branch: adjust the state while rendering when a child turns active (no effect, no extra paint).
  if (active !== wasActive) {
    setWasActive(active);
    if (active) {
      setOpen(true);
    }
  }

  const onOpenChange = (next: boolean) => {
    // On the icon rail the children are hidden: a click expands the sidebar and shows them,
    // instead of toggling a list nobody can see.
    if (sidebar.state === "collapsed" && !sidebar.isMobile) {
      sidebar.setOpen(true);
      setOpen(true);
      return;
    }
    setOpen(next);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="group/collapsible"
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={<SidebarMenuButton tooltip={branch.title} isActive={active} className={ROW} />}
      >
        <branch.icon />
        <span>{branch.title}</span>
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* The legacy children: no line of their own, a 2 px bar on each row's left instead. */}
        <SidebarMenuSub className="mx-0 ml-6 gap-0 border-l-0 px-0 py-1">
          {branch.children.map((child) => (
            <SidebarMenuSubItem key={child.route.path}>
              <SidebarMenuSubButton
                render={<Link href={href(child.route)} />}
                isActive={isNavItemActive(pathname, child)}
                // Selected: the bar in the brand colour and the title bold, without the tint.
                className="h-9 rounded-none border-l-2 border-sidebar-border pl-3 data-active:border-sidebar-primary data-active:bg-transparent data-active:font-bold"
                onClick={() => {
                  sidebar.setOpenMobile(false);
                }}
              >
                <child.icon />
                <span>{child.route.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
};

/** One nav group of the sidebar: optional label, then leaves and collapsible branches. */
export const NavMain = ({ group, pathname }: { group: NavGroup; pathname: string }) => (
  // Rows reach the sidebar's edges (the legacy groups had no side padding); the icon rail keeps it.
  <SidebarGroup className="px-0 group-data-[collapsible=icon]:px-2">
    {group.label ? <SidebarGroupLabel className="px-4">{group.label}</SidebarGroupLabel> : null}
    <SidebarMenu className="gap-1">
      {group.items.map((item) =>
        item.kind === "leaf" ? (
          <NavLeafItem key={item.route.path} leaf={item} pathname={pathname} />
        ) : (
          <NavBranchItem key={item.title} branch={item} pathname={pathname} />
        ),
      )}
    </SidebarMenu>
  </SidebarGroup>
);
