"use client";

import { FileIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";

import { formatSize, matchesAccept } from "./file-utils";
import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps, FileFieldValue } from "./types";
import { useFormField } from "./use-form-field";

export type FileFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  /** Same syntax as `<input accept>`: `"image/*,.pdf"`. */
  accept?: string;
  multiple?: boolean;
  /** Per-file limit in bytes. */
  maxSize?: number;
  /** Maximum number of files when `multiple`. */
  maxFiles?: number;
  /**
   * Upload handler. When given, the picked `File` is uploaded immediately and the stored value
   * is the returned reference (`id`/`url`); without it the `File` itself stays in the value.
   */
  upload?: (file: File) => Promise<Pick<FileFieldValue, "id" | "url">>;
  dropLabel?: string;
};

const fileKey = (file: Pick<FileFieldValue, "name" | "size">) =>
  `${file.name}:${String(file.size)}`;

const toFiles = (value: unknown): FileFieldValue[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is FileFieldValue =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as FileFieldValue).name === "string",
      )
    : [];

/**
 * Drop zone + file list. The value is `FileFieldValue[]` (also for `multiple={false}`, then at
 * most one entry) so the zod schema is the same shape either way.
 */
export const FileField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  accept,
  multiple = false,
  maxSize,
  maxFiles,
  upload,
  dropLabel = "ファイルをドロップ、またはクリックして選択",
}: FileFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const files = toFiles(field.value);
  const limit = multiple ? maxFiles : 1;
  const full = limit !== undefined && files.length >= limit;
  // While an upload runs the value holds a file without its id, which the form schema refuses;
  // that is waiting, not an error, so the field shows it only once the uploads are over.

  // Uploads finish after later picks and removals, so every write starts from the latest value,
  // never from the value an earlier pick saw.
  const latestRef = useRef<FileFieldValue[]>(files);
  useEffect(() => {
    latestRef.current = toFiles(field.value);
  }, [field.value]);
  const commit = (next: FileFieldValue[]) => {
    latestRef.current = next;
    field.onChange(next);
  };

  const addFiles = async (picked: FileList | File[]) => {
    const errors: string[] = [];
    const current = latestRef.current;
    const accepted: File[] = [];
    for (const file of Array.from(picked)) {
      // Files are told apart by name and size; the same file twice would be one row twice.
      const taken = [...current, ...accepted].some((item) => fileKey(item) === fileKey(file));
      if (taken) {
        errors.push(`${file.name}: すでに選択されています`);
      } else if (!matchesAccept(file, accept)) {
        errors.push(`${file.name}: この形式は選択できません`);
      } else if (maxSize !== undefined && file.size > maxSize) {
        errors.push(`${file.name}: ${formatSize(maxSize)} を超えています`);
      } else if (limit !== undefined && current.length + accepted.length >= limit) {
        errors.push(`${file.name}: 最大 ${String(limit)} 件までです`);
      } else {
        accepted.push(file);
      }
    }
    setLocalErrors(errors);
    if (accepted.length === 0) {
      return;
    }
    const entries: FileFieldValue[] = accepted.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    commit(multiple ? [...current, ...entries] : entries);

    if (!upload) {
      return;
    }
    setUploading((keys) => [...keys, ...accepted.map(fileKey)]);
    await Promise.all(
      accepted.map(async (file) => {
        const entry = { name: file.name, size: file.size, type: file.type };
        try {
          const uploaded = await upload(file);
          commit(
            latestRef.current.map((item) =>
              fileKey(item) === fileKey(entry) ? { ...entry, ...uploaded } : item,
            ),
          );
        } catch (error) {
          setLocalErrors((previous) => [
            ...previous,
            `${entry.name}: ${error instanceof Error ? error.message : "アップロードに失敗しました"}`,
          ]);
          commit(latestRef.current.filter((item) => fileKey(item) !== fileKey(entry)));
        } finally {
          setUploading((keys) => keys.filter((key) => key !== fileKey(entry)));
        }
      }),
    );
  };

  const remove = (target: FileFieldValue) => {
    commit(latestRef.current.filter((item) => fileKey(item) !== fileKey(target)));
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!field.disabled) {
      void addFiles(event.dataTransfer.files);
    }
  };

  return (
    <FormFieldShell
      htmlFor={field.name}
      label={label}
      required={required}
      hint={hint}
      description={description}
      error={uploading.length > 0 ? undefined : fieldState.error}
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
        multiple={multiple}
        disabled={field.disabled}
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files) {
            void addFiles(event.target.files);
          }
          event.target.value = "";
        }}
        onBlur={field.onBlur}
      />
      <button
        type="button"
        disabled={Boolean(field.disabled) || full}
        aria-invalid={fieldState.invalid && uploading.length === 0}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive ${dragging ? "border-ring bg-muted/50" : "border-input"}`}
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
        <UploadIcon className="size-5" />
        <span>{full ? "上限に達しました" : dropLabel}</span>
        {accept || maxSize !== undefined ? (
          <span className="text-xs">
            {[accept, maxSize === undefined ? null : `最大 ${formatSize(maxSize)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </button>
      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((file) => {
            const pending = uploading.includes(fileKey(file));
            return (
              <li
                key={fileKey(file)}
                className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
              >
                {pending ? (
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <FileIcon className="size-4 text-muted-foreground" />
                )}
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                  >
                    {file.name}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${file.name} を削除`}
                  disabled={Boolean(field.disabled) || pending}
                  onClick={() => {
                    remove(file);
                  }}
                >
                  <XIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {localErrors.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-destructive">
          {localErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </FormFieldShell>
  );
};
