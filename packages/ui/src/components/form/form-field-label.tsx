"use client";

import { InfoIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { FieldLabel, FieldLegend } from "../field";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";

export type FormFieldLabelProps = {
  htmlFor?: string;
  required?: boolean | undefined;
  hint?: string | undefined;
  /** Render as a `<legend>` for grouped controls (radio, checkbox group). */
  asLegend?: boolean;
  className?: string;
  children: string;
};

const LabelExtras = ({ required, hint }: Pick<FormFieldLabelProps, "required" | "hint">) => (
  <>
    {required ? (
      <span aria-hidden className="text-destructive">
        *
      </span>
    ) : null}
    {hint ? (
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" className="text-muted-foreground" aria-label={hint} />}
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    ) : null}
  </>
);

/** Field label with the optional required marker and hint tooltip every form field shares. */
export const FormFieldLabel = ({
  htmlFor,
  required,
  hint,
  asLegend = false,
  className,
  children,
}: FormFieldLabelProps) => {
  if (asLegend) {
    const legendProps: ComponentProps<typeof FieldLegend> = className ? { className } : {};
    return (
      <FieldLegend {...legendProps}>
        <span className="inline-flex items-center gap-1">
          {children}
          <LabelExtras required={required} hint={hint} />
        </span>
      </FieldLegend>
    );
  }
  return (
    <FieldLabel htmlFor={htmlFor} className={className}>
      {children}
      <LabelExtras required={required} hint={hint} />
    </FieldLabel>
  );
};
