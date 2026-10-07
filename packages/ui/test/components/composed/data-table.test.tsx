import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDataTableColumns, DataTable } from "../../../src/components/composed/data-table";
import type { DataTableSortingState } from "../../../src/components/composed/data-table";

afterEach(cleanup);

type Person = { id: string; name: string; email: string };

const people: Person[] = [
  { id: "1", name: "Amy", email: "amy@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

const helper = createDataTableColumns<Person>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name", enableSorting: true }),
  helper.accessor("email", { header: "Email" }),
]);

/** Renders a sortable table and returns the `onChange` spy with the state it was last given. */
const renderSortable = (state: DataTableSortingState) => {
  const onChange = vi.fn();
  render(<DataTable columns={columns} data={people} sorting={{ state, onChange }} />);
  return onChange;
};

/** The value `onChange` was called with, resolving an updater function against `previous`. */
const nextState = (
  onChange: ReturnType<typeof vi.fn>,
  previous: DataTableSortingState,
): DataTableSortingState => {
  const [arg] = onChange.mock.lastCall as [unknown];
  return typeof arg === "function"
    ? (arg as (old: DataTableSortingState) => DataTableSortingState)(previous)
    : (arg as DataTableSortingState);
};

describe("DataTable sorting", () => {
  it("renders a sort button only for columns that opt in", () => {
    renderSortable([]);

    expect(screen.getByRole("button", { name: /Name/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Email/ })).toBeNull();
  });

  it("reports the next sorting when a sortable header is clicked", () => {
    const onChange = renderSortable([]);

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));

    expect(nextState(onChange, [])).toEqual([{ id: "name", desc: false }]);
  });

  it("toggles between ascending and descending without a third, unsorted click", () => {
    const ascending: DataTableSortingState = [{ id: "name", desc: false }];
    const onChange = renderSortable(ascending);

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));

    expect(nextState(onChange, ascending)).toEqual([{ id: "name", desc: true }]);
  });

  it("marks the sorted column for assistive technology and leaves the others unmarked", () => {
    renderSortable([{ id: "name", desc: true }]);

    const [nameHeader, emailHeader] = screen.getAllByRole("columnheader");
    expect(nameHeader?.getAttribute("aria-sort")).toBe("descending");
    expect(emailHeader?.getAttribute("aria-sort")).toBeNull();
  });

  it("renders the rows in the order given: the server sorts, the table does not", () => {
    renderSortable([{ id: "name", desc: true }]);

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual(["Amy", "amy@example.com", "Bob", "bob@example.com"]);
  });

  it("renders no sort buttons when the table is not sortable", () => {
    render(<DataTable columns={columns} data={people} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("DataTable pagination", () => {
  it("renders the pagination bar inside the table's card", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={people}
        pagination={{
          page: 1,
          totalPages: 3,
          total: 42,
          hasPrev: false,
          hasNext: true,
          onPageChange: () => undefined,
          labels: { next: "次のページ", summary: ({ total }) => `全 ${String(total)} 件` },
        }}
      />,
    );

    expect(screen.getByText("全 42 件")).toBeDefined();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDefined();
    expect(container.firstElementChild?.contains(screen.getByRole("table"))).toBe(true);
    expect(container.firstElementChild?.contains(screen.getByText("全 42 件"))).toBe(true);
  });
});

describe("DataTable row selection", () => {
  /** Renders a selectable table and returns the `onChange` spy. */
  const renderSelectable = (state: Record<string, true>) => {
    const onChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={people}
        getRowId={(row) => row.id}
        rowSelection={{
          state,
          onChange,
          labels: { all: "Select page", row: (person) => `Select ${person.name}` },
        }}
      />,
    );
    return onChange;
  };

  /** The value `onChange` was called with, resolving an updater against `previous`. */
  const nextSelection = (onChange: ReturnType<typeof vi.fn>, previous: Record<string, true>) => {
    const [arg] = onChange.mock.lastCall as [unknown];
    return typeof arg === "function"
      ? (arg as (old: Record<string, true>) => Record<string, true>)(previous)
      : (arg as Record<string, true>);
  };

  it("adds a checkbox column and ticks the selected rows", () => {
    renderSelectable({ "2": true });

    expect(screen.getByRole("checkbox", { name: "Select Amy" }).getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(screen.getByRole("checkbox", { name: "Select Bob" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Select page" }).getAttribute("aria-checked")).toBe(
      "mixed",
    );
  });

  it("selects one row by its id", () => {
    const onChange = renderSelectable({});

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Amy" }));

    expect(nextSelection(onChange, {})).toEqual({ "1": true });
  });

  it("selects every row of the page from the header", () => {
    const onChange = renderSelectable({});

    fireEvent.click(screen.getByRole("checkbox", { name: "Select page" }));

    expect(nextSelection(onChange, {})).toEqual({ "1": true, "2": true });
  });

  it("has no checkboxes when the table is not selectable", () => {
    render(<DataTable columns={columns} data={people} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
