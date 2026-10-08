"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { FormActions } from "@repo/ui/components/form";
import { createCommentTemplateSchema } from "@repo/validation";
import type { CreateCommentTemplateFormValues, UpdateCommentTemplateInput } from "@repo/validation";

import { CommentTemplateFields } from "@/features/comment-templates/components/comment-template-fields";
import type { CommentTemplateRow } from "@/features/comment-templates/types";

export type CommentTemplateUpdateFormProps = {
  template: CommentTemplateRow;
  pending: boolean;
  onSubmit: (input: UpdateCommentTemplateInput) => void;
  onCancel: () => void;
};

/**
 * テンプレート編集: the template's fields; 更新 is enabled once something changed and sends only
 * the changes. The menus arrive in the legacy order from both sides, so joining compares them.
 */
export const CommentTemplateUpdateForm = ({
  template,
  pending,
  onSubmit,
  onCancel,
}: CommentTemplateUpdateFormProps) => {
  const form = useForm<CreateCommentTemplateFormValues>({
    resolver: zodResolver(createCommentTemplateSchema),
    defaultValues: { types: template.types, short: template.short, content: template.content },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(({ types, short, content }) => {
        onSubmit({
          commentTemplateId: template.id,
          ...(types.join() === template.types.join() ? {} : { types }),
          ...(short === template.short ? {} : { short }),
          ...(content === template.content ? {} : { content }),
        });
      })}
    >
      <CommentTemplateFields control={form.control} />
      <FormActions
        className="*:flex-1"
        submitLabel="更新"
        pendingLabel="更新中…"
        pending={pending}
        disabled={!form.formState.isDirty}
      >
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
      </FormActions>
    </form>
  );
};
