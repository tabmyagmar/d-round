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

// Every link closes the mobile sheet; on desktop `setOpenMobile(false)` changes nothing.
const NavLeafItem = ({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) => {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={href(leaf.route)} />}
        isActive={isNavItemActive(pathname, leaf)}
        tooltip={leaf.route.title}
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
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={branch.title} isActive={active} />}>
        <branch.icon />
        <span>{branch.title}</span>
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {branch.children.map((child) => (
            <SidebarMenuSubItem key={child.route.path}>
              <SidebarMenuSubButton
                render={<Link href={href(child.route)} />}
                isActive={isNavItemActive(pathname, child)}
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
  <SidebarGroup>
    {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
    <SidebarMenu>
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
