"use client";

import { cn } from "cn";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { useController } from "react-hook-form";
import type { FieldValues } from "react-hook-form";

import { Button } from "../button";
import { Field, FieldDescription, FieldError, FieldLabel } from "../field";
import { Input } from "../input";

import type { BaseFieldProps } from "./types";

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
  disabled,
  className,
  autoComplete = "current-password",
  placeholder,
}: PasswordFieldProps<TValues>) => {
  // `ref` is pulled out so the React Compiler lint (react-hooks/refs) does not treat the whole
  // `field` object as a ref; it is only ever forwarded to the input element.
  const {
    field: { ref, ...field },
    fieldState,
  } = useController({
    control,
    name,
    ...(disabled === undefined ? {} : { disabled }),
  });
  const [visible, setVisible] = useState(false);
  const value: unknown = field.value;

  return (
    <Field className={className}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={field.name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          name={field.name}
          ref={ref}
          disabled={field.disabled}
          aria-invalid={fieldState.invalid}
          className={cn("pr-9")}
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
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => {
            setVisible((current) => !current);
          }}
          disabled={field.disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[fieldState.error]} />
    </Field>
  );
};
