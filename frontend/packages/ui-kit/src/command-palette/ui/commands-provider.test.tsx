// @vitest-environment happy-dom
import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandState } from "@camera-path/types/commands";
import { Slot, SlotProvider } from "@camera-path/slots";
import { CommandsProvider, useRegisterCommands } from "..";

function Registrar({ commands, disabled, error }: CommandState) {
  useRegisterCommands(commands, { disabled, error });
  return null;
}

afterEach(cleanup);

describe("CommandsProvider", () => {
  it("requires a provider for lifecycle registration", () => {
    expect(() =>
      render(<Registrar commands={[]} disabled={false} error={null} />),
    ).toThrow("useRegisterCommands requires CommandsProvider");
  });

  it("updates a selected command's items and handler while the palette is open", () => {
    const before = vi.fn();
    const after = vi.fn();
    const view = (id: string, onSelectItem: (id: string) => void) => (
      <CommandsProvider>
        <Registrar
          commands={[
            {
              id: "cloud.remove",
              label: "Remove cloud",
              items: [{ id, label: id }],
              onSelectItem,
              emptyMessage: "No clouds",
            },
          ]}
          disabled={false}
          error={null}
        />
      </CommandsProvider>
    );
    const { rerender } = render(view("old", before));
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    rerender(view("new", after));
    expect(screen.queryByRole("option", { name: "old" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(after).toHaveBeenCalledExactlyOnceWith("new");
    expect(before).not.toHaveBeenCalled();
    rerender(
      <CommandsProvider>
        <Registrar
          commands={[{ id: "reset", label: "Reset camera", onSelect: vi.fn() }]}
          disabled={false}
          error={null}
        />
      </CommandsProvider>,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(
      screen.getByRole("combobox", { name: "Search commands" }),
    ).toBeTruthy();
  });
  it("searches commands from multiple feature slots in one palette", () => {
    const selectCloud = vi.fn();
    const selectCamera = vi.fn();
    function CloudCommands() {
      useRegisterCommands([
        { id: "cloud.add", label: "Add cloud", onSelect: selectCloud },
      ]);
      return null;
    }
    function CameraCommands() {
      useRegisterCommands([
        {
          id: "camera.reset",
          label: "Reset camera",
          searchText: "home",
          onSelect: selectCamera,
        },
      ]);
      return null;
    }
    render(
      <SlotProvider
        features={[
          { project: { commands: [CloudCommands] } },
          { project: { commands: [CameraCommands] } },
        ]}
      >
        <CommandsProvider>
          <Slot name="project.commands" />
        </CommandsProvider>
      </SlotProvider>,
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    const search = screen.getByRole("combobox");
    fireEvent.focus(search);
    expect(
      screen.getAllByRole("option").map((item) => item.textContent),
    ).toEqual(["Add cloud", "Reset camera"]);
    fireEvent.change(search, { target: { value: "home" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(selectCamera).toHaveBeenCalledOnce();
    expect(selectCloud).not.toHaveBeenCalled();
  });

  it("replaces data and callbacks without changing order, and cleans up in Strict Mode", () => {
    const before = vi.fn();
    const after = vi.fn();
    const second = { id: "second", label: "Second", onSelect: vi.fn() };
    const view = (label: string, onSelect: () => void, present = true) => (
      <StrictMode>
        <CommandsProvider>
          {present && (
            <Registrar
              commands={[{ id: "first", label, onSelect }]}
              disabled={false}
              error={null}
            />
          )}
          <Registrar commands={[second]} disabled={false} error={null} />
        </CommandsProvider>
      </StrictMode>
    );
    const { rerender } = render(view("Before", before));
    fireEvent.focus(screen.getByRole("combobox"));
    rerender(view("After", after));
    expect(
      screen.getAllByRole("option").map((item) => item.textContent),
    ).toEqual(["After", "Second"]);
    fireEvent.click(screen.getByRole("option", { name: "After" }));
    expect(after).toHaveBeenCalledOnce();
    expect(before).not.toHaveBeenCalled();
    rerender(view("After", after, false));
    fireEvent.focus(screen.getByRole("combobox"));
    expect(
      screen.getAllByRole("option").map((item) => item.textContent),
    ).toEqual(["Second"]);
    rerender(
      <StrictMode>
        <CommandsProvider>{null}</CommandsProvider>
      </StrictMode>,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("keeps busy states and errors scoped to their contributor", () => {
    const busy = vi.fn();
    const available = vi.fn();
    const { rerender } = render(
      <CommandsProvider>
        <Registrar
          commands={[{ id: "busy", label: "Busy", onSelect: busy }]}
          disabled
          error="Cloud failed"
        />
        <Registrar
          commands={[
            { id: "available", label: "Available", onSelect: available },
          ]}
          disabled={false}
          error={null}
        />
      </CommandsProvider>,
    );
    const search = screen.getByRole("combobox");
    fireEvent.focus(search);
    expect(
      (screen.getByRole("option", { name: "Busy" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(busy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Available" }));
    expect(available).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toBe("Cloud failed");
    rerender(<CommandsProvider>{null}</CommandsProvider>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("isolates providers, including identical command IDs", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <section data-testid="first">
          <CommandsProvider>
            <Registrar
              commands={[{ id: "reset", label: "Reset", onSelect: first }]}
              disabled={false}
              error={null}
            />
          </CommandsProvider>
        </section>
        <section data-testid="second">
          <CommandsProvider>
            <Registrar
              commands={[{ id: "reset", label: "Reset", onSelect: second }]}
              disabled={false}
              error={null}
            />
          </CommandsProvider>
        </section>
      </>,
    );
    const palette = within(screen.getByTestId("second"));
    fireEvent.focus(palette.getByRole("combobox"));
    fireEvent.keyDown(palette.getByRole("combobox"), { key: "Enter" });
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("rejects conflicting command IDs rather than selecting another feature's callback", () => {
    expect(() =>
      render(
        <CommandsProvider>
          <Registrar
            commands={[{ id: "same", label: "First", onSelect: vi.fn() }]}
            disabled={false}
            error={null}
          />
          <Registrar
            commands={[{ id: "same", label: "Second", onSelect: vi.fn() }]}
            disabled={false}
            error={null}
          />
        </CommandsProvider>,
      ),
    ).toThrow("Duplicate command ID: same");
  });
});
