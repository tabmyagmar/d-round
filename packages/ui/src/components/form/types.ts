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
  disabled?: boolean;
  className?: string;
};

export type SelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};
