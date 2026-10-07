import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FormActions } from "../../../src/components/form";

afterEach(cleanup);

describe("FormActions", () => {
  it("puts the secondary actions before the submit button", () => {
    render(
      <FormActions submitLabel="Save">
        <button type="button">Cancel</button>
      </FormActions>,
    );

    const [cancel, save] = screen.getAllByRole("button");
    expect(cancel?.textContent).toBe("Cancel");
    expect(save?.textContent).toBe("Save");
    expect(save?.getAttribute("type")).toBe("submit");
  });

  it("shows the pending label and blocks a second submit while pending", () => {
    render(<FormActions submitLabel="Save" pendingLabel="Saving…" pending />);

    const save = screen.getByRole("button", { name: "Saving…" });
    expect(save).toHaveProperty("disabled", true);
    expect(save.getAttribute("aria-busy")).toBe("true");
  });

  it("disables the submit button when told to", () => {
    render(<FormActions submitLabel="Save" disabled />);

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
  });
});
