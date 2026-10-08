import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { TextField } from "../../../src/components/form/text-field";

type Values = { name: string };

/** Minimal react-hook-form host; `error` simulates a server-side validation error. */
const Harness = ({ error }: { error?: string }) => {
  const form = useForm<Values>({
    defaultValues: { name: "" },
    ...(error ? { errors: { name: { type: "manual", message: error } } } : {}),
  });
  return <TextField control={form.control} name="name" label="Full name" />;
};

afterEach(cleanup);

describe("TextField", () => {
  it("renders a labelled input bound to the field name", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Full name");
    expect(input.getAttribute("name")).toBe("name");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("shows the field error and marks the input invalid", () => {
    render(<Harness error="Required" />);
    expect(screen.getByText("Required")).toBeDefined();
    expect(screen.getByLabelText("Full name").getAttribute("aria-invalid")).toBe("true");
  });

  it("hands each edit's text to onValueChange after the field took it", () => {
    const seen: { text: string; stored: unknown }[] = [];
    const Watching = () => {
      const form = useForm<Values>({ defaultValues: { name: "" } });
      return (
        <TextField
          control={form.control}
          name="name"
          label="Full name"
          onValueChange={(text) => {
            seen.push({ text, stored: form.getValues("name") });
          }}
        />
      );
    };
    render(<Watching />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Amy" } });

    expect(seen).toEqual([{ text: "Amy", stored: "Amy" }]);
  });
});
