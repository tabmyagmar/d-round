import { cn } from "cn";
import { Check } from "lucide-react";

export type StepperProps = {
  /** One label per step, in order. */
  steps: readonly string[];
  /** The index of the current step. */
  current: number;
  /** Makes the completed steps buttons back to themselves (the legacy d-round `Steps`). */
  onStepClick?: (index: number) => void;
  /** The list's accessible name. */
  label?: string;
  className?: string;
};

/**
 * The steps of a multi-step form, as romuten-v3's `Stepper`: a numbered circle per step (a check
 * once completed) with its label, joined by a line, the current step marked `aria-current="step"`.
 * Going back goes through the completed steps when `onStepClick` is given; going forward is the
 * form's job after it validated the step (`useStepper`). Hook-free.
 */
export const Stepper = ({
  steps,
  current,
  onStepClick,
  label = "Progress",
  className,
}: StepperProps) => (
  <nav aria-label={label} className={className}>
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const completed = index < current;
        const isCurrent = index === current;
        const isLast = index === steps.length - 1;
        const content = (
          <>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                completed && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary bg-primary/10 text-primary",
                !completed && !isCurrent && "border-border bg-card text-muted-foreground",
              )}
            >
              {completed ? <Check aria-hidden className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-sm whitespace-nowrap",
                completed || isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </>
        );
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className={cn("flex items-center gap-2", !isLast && "flex-1")}
          >
            {completed && onStepClick ? (
              <button
                type="button"
                className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  onStepClick(index);
                }}
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
            {isLast ? null : (
              <span
                aria-hidden
                className={cn("h-px min-w-4 flex-1", completed ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
