"use client";

import { Loader2Icon, UploadIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { FieldValues } from "react-hook-form";

import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import { Button } from "../button";

import { formatSize, matchesAccept } from "./file-utils";
import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps, FileFieldValue } from "./types";
import { useFormField } from "./use-form-field";

export type AvatarFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  /** Same syntax as `<input accept>`: `"image/png,image/jpeg"`. */
  accept?: string;
  /** Limit in bytes. */
  maxSize?: number;
  /** Uploads the picked image; the stored value becomes the returned reference (`id`, `url`). */
  upload: (file: File) => Promise<Pick<FileFieldValue, "id" | "url">>;
  /** Diameter in pixels. */
  size?: number;
};

const isFileValue = (value: unknown): value is FileFieldValue =>
  typeof value === "object" && value !== null && typeof (value as FileFieldValue).name === "string";

/**
 * One round image: click or drop to pick, uploaded at once, a remove button in the corner. The
 * value is a `FileFieldValue` (or `null`): the stored image's reference, or a picked file with a
 * local preview URL (`url`), first while it uploads and then with its `id`. A failed upload puts
 * the previous value back, its preview included, and shows why under the circle.
 */
export const AvatarField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  accept = "image/*",
  maxSize,
  upload,
  size = 120,
}: AvatarFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Preview URLs of picked files; a failed upload may bring an earlier one back, so they are
  // released only when the field goes away.
  const previewsRef = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const value = isFileValue(field.value) ? field.value : null;
  const shown = value?.url ?? null;
  const locked = Boolean(field.disabled) || uploading;
  // While an upload runs the value holds a file without its id, which the form schema refuses;
  // that is waiting, not an error, so the field shows it only once the upload is over.
  const invalid = fieldState.invalid && !uploading;

  useEffect(
    () => () => {
      for (const url of previewsRef.current) {
        URL.revokeObjectURL(url);
      }
      previewsRef.current = [];
    },
    [],
  );

  const pick = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!matchesAccept(file, accept)) {
      setLocalError(`${file.name}: この形式は選択できません`);
      return;
    }
    if (maxSize !== undefined && file.size > maxSize) {
      setLocalError(`${file.name}: ${formatSize(maxSize)} を超えています`);
      return;
    }
    const previous = value;
    const preview = URL.createObjectURL(file);
    previewsRef.current.push(preview);
    const entry = { name: file.name, size: file.size, type: file.type, url: preview };
    setLocalError(null);
    field.onChange({ ...entry, file });
    setUploading(true);
    try {
      const { id } = await upload(file);
      field.onChange({ ...entry, ...(id === undefined ? {} : { id }) });
    } catch (error) {
      field.onChange(previous);
      setLocalError(
        `${file.name}: ${error instanceof Error ? error.message : "アップロードに失敗しました"}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!locked) {
      void pick(event.dataTransfer.files[0]);
    }
  };

  return (
    <FormFieldShell
      htmlFor={field.name}
      label={label}
      required={required}
      hint={hint}
      description={description}
      error={uploading ? undefined : fieldState.error}
      className={className}
    >
      <input
        id={field.name}
        ref={(element) => {
          inputRef.current = element;
          ref(element);
        }}
        type="file"
        className="sr-only"
        name={field.name}
        accept={accept}
        disabled={locked}
        tabIndex={-1}
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
        onBlur={field.onBlur}
      />
      {/* `Field` stretches its children; the inner box keeps the corner button on the circle. */}
      <div>
        <div className="relative w-fit">
          <button
            type="button"
            aria-label={shown ? `${label}を変更` : `${label}を選択`}
            aria-invalid={invalid}
            disabled={locked}
            style={{ width: size, height: size }}
            className={`group relative flex items-center justify-center rounded-full border-2 border-dashed transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed aria-invalid:border-destructive ${dragging ? "border-ring bg-muted/50" : shown ? "border-transparent" : "border-input bg-muted/50 hover:border-ring"}`}
            onClick={() => {
              inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={onDrop}
          >
            <Avatar className="size-full after:border-0">
              {shown ? <AvatarImage src={shown} alt={label} /> : null}
              <AvatarFallback className="bg-transparent">
                <UserRoundIcon className="size-8 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            {shown && !locked ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                <UploadIcon className="size-6 text-background" />
              </span>
            ) : null}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                <Loader2Icon
                  className="size-6 animate-spin text-primary"
                  aria-label="アップロード中"
                />
              </span>
            ) : null}
          </button>
          {value && !locked ? (
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              className="absolute -top-1 -right-1 rounded-full"
              aria-label={`${label}を削除`}
              onClick={() => {
                setLocalError(null);
                field.onChange(null);
              }}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      </div>
      {localError ? <p className="text-xs text-destructive">{localError}</p> : null}
    </FormFieldShell>
  );
};
