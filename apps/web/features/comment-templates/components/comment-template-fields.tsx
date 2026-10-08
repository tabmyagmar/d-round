"use client";

import type { Control } from "react-hook-form";

import { FieldGroup } from "@repo/ui/components/field";
import { CheckboxGroupField, TextareaField, TextField } from "@repo/ui/components/form";
import { COMMENT_TEMPLATE_CONTENT_MAX, COMMENT_TEMPLATE_SHORT_MAX } from "@repo/validation";
import type { CreateCommentTemplateFormValues } from "@repo/validation";

import { COMMENT_FOR_OPTIONS } from "@/features/comment-templates/utils/comment-template-labels";

/** 使用先メニュー, タイトル, テキスト: the fields テンプレート作成 and テンプレート編集 share. */
export const CommentTemplateFields = ({
  control,
}: {
  control: Control<CreateCommentTemplateFormValues>;
}) => (
  <FieldGroup>
    <CheckboxGroupField
      control={control}
      name="types"
      label="使用先メニュー"
      options={COMMENT_FOR_OPTIONS}
      required
    />
    <TextField
      control={control}
      name="short"
      label="タイトル"
      placeholder="タイトル"
      maxLength={COMMENT_TEMPLATE_SHORT_MAX}
      required
    />
    <TextareaField
      control={control}
      name="content"
      label="テキスト"
      placeholder="テキスト"
      rows={4}
      maxLength={COMMENT_TEMPLATE_CONTENT_MAX}
      required
    />
  </FieldGroup>
);
