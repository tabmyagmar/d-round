import type { ReactNode } from "react";

import { DescriptionList } from "@repo/ui/components/composed/description-list";
import { StatusBadge } from "@repo/ui/components/composed/status-badge";
import { AUDIT_STATUS_LABELS } from "@repo/validation";

import { AuditChanges } from "@/features/audit-log/components/detail/audit-changes";
import type { AuditLogDetail as AuditLogDetailRow } from "@/features/audit-log/types";
import {
  actionLabelOf,
  actorLabelOf,
  changesOf,
  dateTimeOf,
  entityTypeLabelOf,
  roleLabelOf,
} from "@/features/audit-log/utils/audit-log-labels";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-sm font-semibold text-primary">{title}</h3>
    {children}
  </section>
);

/**
 * One row of the log in the sections of romuten-v3's `AuditLogDetailDialog`: 実行者, 操作内容,
 * 変更内容 and 実行環境 (the legacy had no detail).
 */
export const AuditLogDetail = ({ log }: { log: AuditLogDetailRow }) => (
  <div className="flex flex-col gap-5">
    <Section title="実行者">
      <DescriptionList
        items={[
          { label: "名前", value: actorLabelOf(log) },
          { label: "メールアドレス", value: log.actorEmail },
          { label: "権限", value: roleLabelOf(log.actorRole) },
        ]}
      />
    </Section>
    <Section title="操作内容">
      <DescriptionList
        items={[
          { label: "日時", value: dateTimeOf(log.createdAt) },
          { label: "アクション", value: actionLabelOf(log.action) },
          {
            label: "対象",
            value: [entityTypeLabelOf(log.entityType), log.entityLabel].filter(Boolean).join(" "),
          },
          {
            label: "ステータス",
            value: (
              <StatusBadge tone={log.status === "SUCCESS" ? "success" : "danger"}>
                {AUDIT_STATUS_LABELS[log.status]}
              </StatusBadge>
            ),
          },
          ...(log.errorCode ? [{ label: "エラーコード", value: log.errorCode }] : []),
        ]}
      />
    </Section>
    <Section title="変更内容">
      <AuditChanges entityType={log.entityType} changes={changesOf(log.changes)} />
    </Section>
    <Section title="実行環境">
      <DescriptionList
        items={[
          { label: "IPアドレス", value: log.ipAddress },
          { label: "ブラウザ", value: log.userAgent },
          { label: "リクエストID", value: log.requestId },
        ]}
      />
    </Section>
  </div>
);
