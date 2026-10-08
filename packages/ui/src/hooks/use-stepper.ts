import { useRef, useState } from "react";
import type { FieldPath, FieldValues, UseFormTrigger } from "react-hook-form";

export type UseStepperOptions<TValues extends FieldValues> = {
  /** Each step's fields, validated together before the form leaves the step forward. */
  steps: readonly (readonly FieldPath<TValues>[])[];
};

/**
 * The current step of a multi-step form over one schema, as romuten-v3's `useStepper`: `goNext`
 * validates the step's fields with react-hook-form's `trigger` (focusing the first error), then
 * runs `beforeNext` — an async guard such as a uniqueness check that sets its own field error — and
 * moves on only when both pass, one step from where it was asked; a `goNext` asked while another
 * runs (a second click on 次へ) is ignored. `goTo` goes back to an earlier step (the `Stepper`'s
 * completed steps); forward goes through `goNext` only.
 */
export const useStepper = <TValues extends FieldValues>({ steps }: UseStepperOptions<TValues>) => {
  const [current, setCurrent] = useState(0);
  const runningRef = useRef(false);
  const lastIndex = steps.length - 1;

  const goNext = async (
    trigger: UseFormTrigger<TValues>,
    beforeNext?: () => Promise<boolean>,
  ): Promise<boolean> => {
    if (runningRef.current) {
      return false;
    }
    runningRef.current = true;
    try {
      const fields = steps[current] ?? [];
      const valid = fields.length === 0 || (await trigger([...fields], { shouldFocus: true }));
      if (!valid || (beforeNext && !(await beforeNext()))) {
        return false;
      }
      setCurrent(Math.min(current + 1, lastIndex));
      return true;
    } finally {
      runningRef.current = false;
    }
  };

  const goPrev = () => {
    setCurrent((step) => Math.max(step - 1, 0));
  };

  const goTo = (index: number) => {
    setCurrent((step) => (index >= 0 && index < step ? index : step));
  };

  return {
    current,
    isFirst: current === 0,
    isLast: current === lastIndex,
    goNext,
    goPrev,
    goTo,
  };
};
