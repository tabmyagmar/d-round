import type { Control, FieldPath, FieldValues } from "react-hook-form";

/**
 * Props shared by every react-hook-form bound field. Fields are generic over the form values so
 * `name` is type-checked against the zod schema the form was built from.
 */
export type BaseFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  description?: string;
  /** Shows a required marker next to the label. Validation itself stays in the zod schema. */
  required?: boolean;
  /** Short help text shown in a tooltip behind an info icon next to the label. */
  hint?: string;
  disabled?: boolean;
  className?: string;
};

export type SelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

/** What a cleared input stores: `""` (default for text), `null` or `undefined`. */
export type EmptyAs = "string" | "null" | "undefined";

export const EMPTY_VALUES = { string: "", null: null, undefined } as const;

/** A file held by `FileField`: metadata plus either the local `File` or the uploaded reference. */
export type FileFieldValue = {
  name: string;
  size: number;
  type: string;
  /** Present until `upload` has replaced it with `id`/`url`. */
  file?: File;
  /** Server-side reference returned by `upload`. */
  id?: string;
  url?: string;
};
