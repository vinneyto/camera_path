// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandPalette, type CommandPaletteCommand } from "./command-palette";

afterEach(cleanup);

describe("CommandPalette", () => {
  it("searches commands and cloud instances, then sends only the selected ID", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const commands: CommandPaletteCommand[] = [
      {
        id: "add",
        label: "Add cloud",
        items: [{ id: "asset-1", label: "Mug" }],
        onSelectItem: add,
        emptyMessage: "No library clouds.",
      },
      {
        id: "remove",
        label: "Remove cloud",
        items: [
          { id: "instance-1", label: "Mug · 1" },
          { id: "instance-2", label: "Mug · 2" },
        ],
        onSelectItem: remove,
        emptyMessage: "No project clouds.",
      },
    ];
    render(<CommandPalette commands={commands} />);

    const search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "remove" } });
    expect(screen.queryByRole("option", { name: "Add cloud" })).toBeNull();
    fireEvent.keyDown(search, { key: "Enter" });
    const cloudSearch = screen.getByRole("combobox", {
      name: "Search Remove cloud",
    });
    fireEvent.change(cloudSearch, { target: { value: "2" } });
    fireEvent.keyDown(cloudSearch, { key: "Enter" });
    expect(remove).toHaveBeenCalledExactlyOnceWith("instance-2");
    expect(add).not.toHaveBeenCalled();

    fireEvent.focus(search);
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(
      screen.getByRole("combobox", { name: "Search commands" }),
    ).toBeTruthy();
  });

  it("supports a direct command, back navigation, and empty/error states", () => {
    const direct = vi.fn();
    const commands: CommandPaletteCommand[] = [
      { id: "direct", label: "Refresh", onSelect: direct },
      {
        id: "add",
        label: "Add cloud",
        items: [],
        emptyMessage: "Upload a PLY first.",
        onSelectItem: vi.fn(),
      },
    ];
    const { rerender } = render(<CommandPalette commands={commands} />);
    const search = screen.getByRole("combobox");
    fireEvent.focus(search);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByText("Upload a PLY first.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to commands" }));
    fireEvent.click(screen.getByRole("option", { name: "Refresh" }));
    expect(direct).toHaveBeenCalledOnce();

    rerender(
      <CommandPalette
        commands={[{ ...commands[1], error: "Could not load clouds." }]}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load clouds.",
    );
  });
});
