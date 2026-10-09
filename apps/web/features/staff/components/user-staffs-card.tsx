"use client";

import { ChevronDown, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@repo/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { ContentCard } from "@repo/ui/components/composed/content-card";

import { href, routes } from "@/config/routes";
import type { ChargedStaff } from "@/features/staff/types";
import { EMPLOYEE_TYPE_LABELS, staffNameOf } from "@/features/staff/utils/staff-labels";

/**
 * 担当先スタッフ情報 on the user detail, as the legacy UserStaffs: the staff a user is in charge of,
 * one closed group per region (a staff in two regions is under both), each row its name and
 * 雇用区分. A row opens the staff's detail page (the legacy opened it in a dialog). Nothing
 * without staff, as in the legacy.
 */
export const UserStaffsCard = ({ staffs }: { staffs: readonly ChargedStaff[] }) => {
  if (staffs.length === 0) {
    return null;
  }

  const groups = new Map<number, { name: string; staffs: ChargedStaff[] }>();
  for (const staff of staffs) {
    for (const { regionCode, region } of staff.regions) {
      const group = groups.get(regionCode) ?? { name: region.name, staffs: [] };
      group.staffs.push(staff);
      groups.set(regionCode, group);
    }
  }
  const byCode = [...groups.entries()].sort(([a], [b]) => a - b);

  return (
    <ContentCard
      title={
        <>
          <Users aria-hidden className="size-4" />
          担当先スタッフ情報
          <Badge variant="outline">{staffs.length}</Badge>
        </>
      }
      contentClassName="flex max-h-96 flex-col gap-2 overflow-y-auto"
    >
      {byCode.map(([code, group]) => (
        <Collapsible key={code} className="group/region">
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-left text-sm font-medium hover:bg-secondary">
            {group.name}
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform group-data-open/region:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col py-1 text-sm">
              {group.staffs.map((staff) => (
                <li key={staff.id}>
                  <Link
                    href={href(routes.staff.detail, { id: staff.id })}
                    className="flex justify-between gap-4 rounded-md px-3 py-2 hover:bg-accent"
                  >
                    <span>{staffNameOf(staff)}</span>
                    <span className="text-muted-foreground">
                      {EMPLOYEE_TYPE_LABELS[staff.employeeType]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </ContentCard>
  );
};
