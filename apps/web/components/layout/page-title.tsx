"use client";

import Link from "next/link";
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

import { breadcrumbTrail, findRoute } from "@/config/routes";
import { breadcrumbLinks } from "@/lib/auth/route-access";

/**
 * The page's only `h1`, rendered once in the header: the catalog title of `pathname`, with the
 * breadcrumb trail under it when the page sits below another one (hidden below `md`). An
 * intermediate crumb links only to a page this ability may open; otherwise it is plain text.
 * A path outside the catalog (the 404) renders nothing.
 */
export const PageTitle = ({ pathname }: { pathname: string }) => {
  const ability = useAbility();
  const route = findRoute(pathname);
  if (!route) {
    return null;
  }
  const trail = breadcrumbLinks(ability, breadcrumbTrail(pathname));

  return (
    <div className="flex min-w-0 flex-col justify-center">
      <h1 className="truncate font-heading text-lg font-semibold">{route.title}</h1>
      {trail.length > 1 ? (
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            {trail.map((crumb, index) => (
              <Fragment key={crumb.path}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                {crumb.current ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>{crumb.route.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <BreadcrumbItem>
                    {crumb.linkable ? (
                      <BreadcrumbLink render={<Link href={crumb.path} />}>
                        {crumb.route.title}
                      </BreadcrumbLink>
                    ) : (
                      crumb.route.title
                    )}
                  </BreadcrumbItem>
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
    </div>
  );
};
