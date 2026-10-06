"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { useAbility } from "@repo/permissions/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";

import { breadcrumbTrail } from "@/config/routes";
import { breadcrumbLinks } from "@/lib/auth/route-access";

/**
 * Sidebar toggle and the catalog's breadcrumb trail; below `md` only the current page shows. An
 * intermediate crumb links only to a page this ability may open; otherwise it is plain text.
 */
export const AppHeader = () => {
  const trail = breadcrumbLinks(useAbility(), breadcrumbTrail(usePathname()));

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-vertical:h-4 data-vertical:self-auto"
      />
      <Breadcrumb>
        <BreadcrumbList>
          {trail.map((crumb, index) => (
            <Fragment key={crumb.path}>
              {index > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
              {index === trail.length - 1 ? (
                <BreadcrumbItem>
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem className="hidden md:block">
                  {crumb.linkable ? (
                    <BreadcrumbLink render={<Link href={crumb.path} />}>
                      {crumb.title}
                    </BreadcrumbLink>
                  ) : (
                    crumb.title
                  )}
                </BreadcrumbItem>
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
};
