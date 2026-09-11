"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";
import { Input } from "../input";

import { FormFieldShell } from "./form-field-shell";
import type { BaseFieldProps } from "./types";
import { useFormField } from "./use-form-field";

export type PasswordFieldProps<TValues extends FieldValues> = BaseFieldProps<TValues> & {
  autoComplete?: Extract<
    ComponentProps<"input">["autoComplete"],
    "current-password" | "new-password"
  >;
  placeholder?: string;
};

/** Password input with a show/hide toggle. */
export const PasswordField = <TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  hint,
  disabled,
  className,
  autoComplete = "current-password",
  placeholder,
}: PasswordFieldProps<TValues>) => {
  const { ref, field, fieldState } = useFormField({ control, name, disabled });
  const [visible, setVisible] = useState(false);
  const value: unknown = field.value;

  return (
    <FormFieldShell
      htmlFor={field.name}
      label={label}
      required={required}
      hint={hint}
      description={description}
      error={fieldState.error}
      className={className}
    >
      <div className="relative">
        <Input
          id={field.name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-9"
          name={field.name}
          ref={ref}
          disabled={field.disabled}
          aria-invalid={fieldState.invalid}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
          onBlur={field.onBlur}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={field.disabled}
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
    </FormFieldShell>
  );
};
