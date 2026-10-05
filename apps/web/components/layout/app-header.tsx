"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

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

/** Sidebar toggle and the catalog's breadcrumb trail; below `md` only the current page shows. */
export const AppHeader = () => {
  const trail = breadcrumbTrail(usePathname());

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
                  <BreadcrumbLink render={<Link href={crumb.path} />}>{crumb.title}</BreadcrumbLink>
                </BreadcrumbItem>
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
};
