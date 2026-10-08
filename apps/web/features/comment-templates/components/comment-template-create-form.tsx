"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@repo/ui/components/button";
import { FormActions } from "@repo/ui/components/form";
import { createCommentTemplateSchema } from "@repo/validation";
import type { CreateCommentTemplateFormValues, CreateCommentTemplateInput } from "@repo/validation";

import { CommentTemplateFields } from "@/features/comment-templates/components/comment-template-fields";

export type CommentTemplateCreateFormProps = {
  pending: boolean;
  onSubmit: (input: CreateCommentTemplateInput) => void;
  onCancel: () => void;
};

/** テンプレート作成: the fields, then キャンセル and 作成 side by side, as the legacy dialog. */
export const CommentTemplateCreateForm = ({
  pending,
  onSubmit,
  onCancel,
}: CommentTemplateCreateFormProps) => {
  const form = useForm<CreateCommentTemplateFormValues>({
    resolver: zodResolver(createCommentTemplateSchema),
    defaultValues: { types: [], short: "", content: "" },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => {
        onSubmit(values);
      })}
    >
      <CommentTemplateFields control={form.control} />
      <FormActions className="*:flex-1" submitLabel="作成" pendingLabel="作成中…" pending={pending}>
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
      </FormActions>
    </form>
  );
};
