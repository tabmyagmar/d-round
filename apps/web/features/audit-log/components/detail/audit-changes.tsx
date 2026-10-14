import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { auditFieldLabel } from "@repo/validation";
import type { AuditChange } from "@repo/validation";

export type AuditChangesProps = {
  /** The row's target type, whose field list names the fields. */
  entityType: string | null;
  changes: readonly AuditChange[];
};

const valueCell = (value: string | null) =>
  value ?? <span className="text-muted-foreground">—</span>;

/**
 * 変更内容: 項目 / 変更前 / 変更後 of each changed field (the detail and the 変更履歴 share it). A
 * masked field says only that it changed; a cut value says so.
 */
export const AuditChanges = ({ entityType, changes }: AuditChangesProps) =>
  changes.length === 0 ? (
    <p className="text-sm text-muted-foreground">変更された項目はありません</p>
  ) : (
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
                変更あり（非表示）
              </TableCell>
            ) : (
              <>
                <TableCell className="break-words whitespace-pre-wrap">
                  {valueCell(change.before)}
                </TableCell>
                <TableCell className="break-words whitespace-pre-wrap">
                  {valueCell(change.after)}
                  {change.truncated ? (
                    <span className="text-muted-foreground">（一部省略）</span>
                  ) : null}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
