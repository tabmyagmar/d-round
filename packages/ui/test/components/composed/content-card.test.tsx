import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContentCard } from "../../../src/components/composed/content-card";

afterEach(cleanup);

/** True when `first` comes before `second` in the document. */
const precedes = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("ContentCard", () => {
  it("shows the title and its description above the body", () => {
    render(
      <ContentCard title="Basics" description="Edited on the update page.">
        <p>Amy</p>
      </ContentCard>,
    );

    const title = screen.getByText("Basics");
    expect(screen.getByText("Edited on the update page.")).toBeDefined();
    expect(precedes(title, screen.getByText("Amy"))).toBe(true);
  });

  it("sets the title apart from the content: semibold, in the brand colour", () => {
    render(
      <ContentCard title="Basics">
        <p>Amy</p>
      </ContentCard>,
    );

    const classes = screen.getByText("Basics").className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["font-semibold", "text-primary"]));
    expect(classes).not.toContain("font-medium");
  });

  it("puts the actions in the header, beside the title", () => {
    const { container } = render(
      <ContentCard title="People" actions={<button type="button">Next page</button>}>
        <p>Amy</p>
      </ContentCard>,
    );

    const header = container.querySelector("[data-slot=card-header]");
    expect(header?.contains(screen.getByRole("button", { name: "Next page" }))).toBe(true);
    expect(header?.contains(screen.getByText("People"))).toBe(true);
  });

  it("has no header without a title or actions", () => {
    const { container } = render(
      <ContentCard>
        <p>Amy</p>
      </ContentCard>,
    );

    expect(container.querySelector("[data-slot=card-header]")).toBeNull();
    expect(screen.getByText("Amy")).toBeDefined();
  });

  it("styles the body through contentClassName", () => {
    render(
      <ContentCard title="Memos" contentClassName="flex flex-col gap-3">
        <p>Amy</p>
      </ContentCard>,
    );

    const body = screen.getByText("Amy").closest("[data-slot=card-content]");
    expect(body?.className.split(" ")).toEqual(expect.arrayContaining(["flex", "gap-3"]));
  });
});
