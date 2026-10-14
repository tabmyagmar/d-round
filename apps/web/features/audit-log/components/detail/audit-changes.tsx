"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { auditFieldLabel } from "@repo/validation";
import type { AuditChange } from "@repo/validation";

export type AuditChangesProps = {
  /** The row's target type, whose field list names the fields. */
  entityType: string | null;
  changes: readonly AuditChange[];
};

const valueCell = (value: string | null) =>
  value ?? <span className="text-muted-foreground">—</span>;

const MASKED = "変更あり（非表示）";

const cutMark = (change: AuditChange) =>
  "truncated" in change && change.truncated ? (
    <span className="text-muted-foreground">（一部省略）</span>
  ) : null;

/** Below `md` (inside the drawer) each field stacks: its name, then 変更前 and 変更後. */
const StackedChanges = ({ entityType, changes }: AuditChangesProps) => (
  <ul className="flex flex-col gap-2">
    {changes.map((change) => (
      <li key={change.field} className="rounded-md border p-2 text-sm">
        <p className="font-medium">{auditFieldLabel(entityType, change.field)}</p>
        {"masked" in change ? (
          <p className="text-muted-foreground">{MASKED}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3">
            <dt className="text-muted-foreground">変更前</dt>
            <dd className="min-w-0 break-words whitespace-pre-wrap">{valueCell(change.before)}</dd>
            <dt className="text-muted-foreground">変更後</dt>
            <dd className="min-w-0 break-words whitespace-pre-wrap">
              {valueCell(change.after)}
              {cutMark(change)}
            </dd>
          </dl>
        )}
      </li>
    ))}
  </ul>
);

/**
 * 変更内容: 項目 / 変更前 / 変更後 of each changed field (the detail and the 変更履歴 share it), stacked
 * per field below `md`. A masked field says only that it changed; a cut value says so.
 */
export const AuditChanges = ({ entityType, changes }: AuditChangesProps) => {
  const isMobile = useIsMobile();
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">変更された項目はありません</p>;
  }
  if (isMobile) {
    return <StackedChanges entityType={entityType} changes={changes} />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>項目</TableHead>
          <TableHead>変更前</TableHead>
          <TableHead>変更後</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {changes.map((change) => (
          <TableRow key={change.field}>
            <TableCell className="font-medium">
              {auditFieldLabel(entityType, change.field)}
            </TableCell>
            {"masked" in change ? (
              <TableCell colSpan={2} className="text-muted-foreground">
                {MASKED}
              </TableCell>
            ) : (
              <>
                <TableCell className="break-words whitespace-pre-wrap">
                  {valueCell(change.before)}
                </TableCell>
                <TableCell className="break-words whitespace-pre-wrap">
                  {valueCell(change.after)}
                  {cutMark(change)}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
