import {
  BookOpen,
  Bot,
  CircleQuestionMark,
  FileStack,
  ScrollText,
  Settings,
  Stamp,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AppAbility } from "@repo/permissions";

import { routes } from "@/config/routes";
import type { AppRoute } from "@/config/routes";
import { canAccessRoute } from "@/lib/auth/route-access";

/**
 * The sidebar menu. It references catalog routes, never paths, and holds icon components — so only
 * client modules import it (icons never cross the server → client boundary as props).
 */

/** A link to one route. */
export type NavLeaf = { kind: "leaf"; route: AppRoute; icon: LucideIcon };
/** A collapsible heading over leaves; not a link itself (legacy マスター管理). */
export type NavBranch = {
  kind: "branch";
  title: string;
  icon: LucideIcon;
  children: readonly NavLeaf[];
};
export type NavItem = NavLeaf | NavBranch;
export type NavGroup = { id: string; label?: string; items: readonly NavItem[] };

const leaf = (route: AppRoute, icon: LucideIcon): NavLeaf => ({ kind: "leaf", route, icon });

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "main",
    items: [
      leaf(routes.workflow.list, Stamp),
      {
        kind: "branch",
        title: "マスター管理",
        icon: Bot,
        children: [
          leaf(routes.user.list, Users),
          leaf(routes.workflowTemplate.list, FileStack),
          leaf(routes.auditLog.list, ScrollText),
        ],
      },
      leaf(routes.client.list, BookOpen),
      leaf(routes.branch.list, Store),
      leaf(routes.staff.list, UserPlus),
    ],
  },
  {
    id: "settings",
    label: "設定",
    items: [
      // The legacy sidebar's gear (`items.tsx`).
      leaf(routes.settings.privacy, Settings),
      leaf(routes.settings.help, CircleQuestionMark),
    ],
  },
];

const visibleItem = (ability: AppAbility, item: NavItem): NavItem | undefined => {
  if (item.kind === "leaf") {
    return canAccessRoute(ability, item.route) ? item : undefined;
  }
  const children = item.children.filter((child) => canAccessRoute(ability, child.route));
  return children.length > 0 ? { ...item, children } : undefined;
};

/**
 * The menu this ability may see: a leaf iff `canAccessRoute`, a branch iff at least one child
 * stays, a group iff at least one item stays. Builds new groups and branches; `NAV_GROUPS` is
 * never mutated.
 */
export const visibleNavGroups = (ability: AppAbility): NavGroup[] =>
  NAV_GROUPS.flatMap((group) => {
    const items = group.items.flatMap((item) => visibleItem(ability, item) ?? []);
    return items.length > 0 ? [{ ...group, items }] : [];
  });

/** The path itself or any page below it. */
export const isActivePath = (pathname: string, path: string): boolean =>
  pathname === path || pathname.startsWith(`${path}/`);

/** A leaf by its own path; a branch when any of its children is active. */
export const isNavItemActive = (pathname: string, item: NavItem): boolean =>
  item.kind === "leaf"
    ? isActivePath(pathname, item.route.path)
    : item.children.some((child) => isNavItemActive(pathname, child));
