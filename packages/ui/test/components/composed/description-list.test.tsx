import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DescriptionList } from "../../../src/components/composed/description-list";

afterEach(cleanup);

describe("DescriptionList", () => {
  it("pairs each label with its value", () => {
    render(
      <DescriptionList
        items={[
          { label: "Name", value: "Amy" },
          { label: "Email", value: <a href="mailto:amy@example.com">amy@example.com</a> },
        ]}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Name", "Email"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "Amy",
      "amy@example.com",
    ]);
  });

  it("shows a placeholder for an empty value", () => {
    render(<DescriptionList items={[{ label: "Phone", value: null }]} emptyText="Not set" />);

    expect(screen.getByRole("definition").textContent).toBe("Not set");
  });

  it("keeps items that share a label apart by their key, also when they move", () => {
    const first = { key: "a", label: "Memo", value: "First" };
    const second = { key: "b", label: "Memo", value: "Second" };
    const { rerender } = render(<DescriptionList items={[first, second]} />);

    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "First",
      "Second",
    ]);
    rerender(<DescriptionList items={[second]} />);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["Second"]);
  });
});
