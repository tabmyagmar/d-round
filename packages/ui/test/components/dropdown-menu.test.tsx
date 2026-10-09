import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Eye, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../src/components/dropdown-menu";

afterEach(cleanup);

/** Local patch 7 (`.claude/rules/ui.md`): menu icons in the brand colour, as the legacy menus. */
const ICON_IN_BRAND_COLOUR = "data-[variant=default]:[&_svg:not([class*='text-'])]:text-primary";

const openMenu = async () => {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <Eye />
          Detail
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  await screen.findByRole("menu");
};

describe("DropdownMenuItem", () => {
  it("colours a default item's icon in the brand colour, not the black of its text", async () => {
    await openMenu();

    const item = screen.getByRole("menuitem", { name: "Detail" });
    expect(item.getAttribute("data-variant")).toBe("default");
    expect(item.className.split(" ")).toContain(ICON_IN_BRAND_COLOUR);
  });

  it("keeps a destructive item's icon red", async () => {
    await openMenu();

    const item = screen.getByRole("menuitem", { name: "Delete" });
    expect(item.getAttribute("data-variant")).toBe("destructive");
    expect(item.className.split(" ")).toContain(
      "data-[variant=destructive]:*:[svg]:text-destructive",
    );
  });
});
