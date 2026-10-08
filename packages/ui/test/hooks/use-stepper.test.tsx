import { act, cleanup, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { useStepper } from "../../src/hooks/use-stepper";

afterEach(cleanup);

type Values = { name: string; city: string };

/** A form whose two fields are required, split over two steps and a field-less confirm step. */
const renderStepper = (defaults: Values) =>
  renderHook(() => {
    const form = useForm<Values>({ defaultValues: defaults });
    form.register("name", { required: "Name is required" });
    form.register("city", { required: "City is required" });
    const stepper = useStepper<Values>({ steps: [["name"], ["city"], []] });
    return { form, stepper };
  });

describe("useStepper", () => {
  it("stays on a step whose fields are invalid, with their errors set", async () => {
    const { result } = renderStepper({ name: "", city: "" });

    let moved = true;
    await act(async () => {
      moved = await result.current.stepper.goNext(result.current.form.trigger);
    });

    expect(moved).toBe(false);
    expect(result.current.stepper.current).toBe(0);
    expect(result.current.form.getFieldState("name").error?.message).toBe("Name is required");
    // Only the step's own fields are validated.
    expect(result.current.form.getFieldState("city").error).toBeUndefined();
  });

  it("moves on once the step is valid, and validates only that step", async () => {
    const { result } = renderStepper({ name: "Amy", city: "" });

    await act(async () => {
      await result.current.stepper.goNext(result.current.form.trigger);
    });

    expect(result.current.stepper.current).toBe(1);
    expect(result.current.stepper.isFirst).toBe(false);
  });

  it("stays when the guard refuses, and moves when it agrees", async () => {
    const { result } = renderStepper({ name: "Amy", city: "Tokyo" });

    await act(async () => {
      await result.current.stepper.goNext(result.current.form.trigger, () =>
        Promise.resolve(false),
      );
    });
    expect(result.current.stepper.current).toBe(0);

    await act(async () => {
      await result.current.stepper.goNext(result.current.form.trigger, () => Promise.resolve(true));
    });
    expect(result.current.stepper.current).toBe(1);
  });

  it("ignores a goNext asked while one runs: a double click moves one step", async () => {
    const { result } = renderStepper({ name: "Amy", city: "Tokyo" });
    // The guard of the first call answers only when told, so the second call comes while it runs.
    let release: (agreed: boolean) => void = () => undefined;
    let asked: () => void = () => undefined;
    const guardAsked = new Promise<void>((resolve) => {
      asked = resolve;
    });
    const guard = () =>
      new Promise<boolean>((resolve) => {
        release = resolve;
        asked();
      });

    let second = true;
    await act(async () => {
      const first = result.current.stepper.goNext(result.current.form.trigger, guard);
      second = await result.current.stepper.goNext(result.current.form.trigger, guard);
      await guardAsked;
      release(true);
      await first;
    });

    expect(second).toBe(false);
    expect(result.current.stepper.current).toBe(1);
  });

  it("reaches the last step, goes back one or to an earlier step, never forward by goTo", async () => {
    const { result } = renderStepper({ name: "Amy", city: "Tokyo" });

    await act(async () => {
      await result.current.stepper.goNext(result.current.form.trigger);
    });
    await act(async () => {
      await result.current.stepper.goNext(result.current.form.trigger);
    });
    expect(result.current.stepper.isLast).toBe(true);

    act(() => {
      result.current.stepper.goPrev();
    });
    expect(result.current.stepper.current).toBe(1);
    act(() => {
      result.current.stepper.goTo(2);
    });
    expect(result.current.stepper.current).toBe(1);
    act(() => {
      result.current.stepper.goTo(0);
    });
    expect(result.current.stepper.current).toBe(0);
    expect(result.current.stepper.isFirst).toBe(true);
  });
});
