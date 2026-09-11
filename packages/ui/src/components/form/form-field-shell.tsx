"use client";

import type { ReactNode } from "react";
import type { FieldError as RhfFieldError } from "react-hook-form";

import { Field, FieldDescription, FieldError } from "../field";

import { FormFieldLabel } from "./form-field-label";

export type FormFieldShellProps = {
  /** id of the control the label points at. */
  htmlFor: string;
  label: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  description?: string | undefined;
  error: RhfFieldError | undefined;
  /** Character counter rendered under the control (`12 / 200`). */
  counter?: { length: number; max: number } | undefined;
  className?: string | undefined;
  children: ReactNode;
};

/** Vertical label / control / description / error frame shared by the single-control fields. */
export const FormFieldShell = ({
  htmlFor,
  label,
  required,
  hint,
  description,
  error,
  counter,
  className,
  children,
}: FormFieldShellProps) => (
  <Field className={className}>
    <FormFieldLabel htmlFor={htmlFor} required={required} hint={hint}>
      {label}
    </FormFieldLabel>
    {children}
    {description || counter ? (
      <div className="flex items-start justify-between gap-2">
        {description ? <FieldDescription>{description}</FieldDescription> : <span />}
        {counter ? (
          <span
            className={
              counter.length > counter.max
                ? "text-xs text-destructive tabular-nums"
                : "text-xs text-muted-foreground tabular-nums"
            }
          >
            {counter.length} / {counter.max}
          </span>
        ) : null}
      </div>
    ) : null}
    <FieldError errors={[error]} />
  </Field>
);
