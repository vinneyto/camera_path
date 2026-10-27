// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, expect, it, vi } from "vitest";
import { Tooltip } from "./tooltip";
import { TooltipProvider } from "./tooltip-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("closes on click despite retained pointer focus and opens only the next hovered tooltip", () => {
  render(
    <TooltipProvider>
      <Tooltip label="First hint">
        <button>First</button>
      </Tooltip>
      <Tooltip label="Second hint">
        <button>Second</button>
      </Tooltip>
    </TooltipProvider>,
  );
  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });
  vi.spyOn(first, "matches").mockReturnValue(false);
  fireEvent.pointerEnter(first);
  expect(screen.getByRole("tooltip").textContent).toBe("First hint");
  first.focus();
  fireEvent.click(first);
  expect(document.activeElement).toBe(first);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.pointerEnter(second);
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip").textContent).toBe("Second hint");
  fireEvent.pointerLeave(first);
  expect(screen.getByRole("tooltip").textContent).toBe("Second hint");
  fireEvent.pointerLeave(second);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("supports keyboard focus, Escape and activation without accumulating pointer and focus hints", () => {
  render(
    <TooltipProvider>
      <Tooltip label="First hint">
        <button>First</button>
      </Tooltip>
      <Tooltip label="Second hint">
        <button>Second</button>
      </Tooltip>
    </TooltipProvider>,
  );
  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });
  vi.spyOn(first, "matches").mockReturnValue(true);
  fireEvent.focusIn(first);
  expect(screen.getByRole("tooltip").textContent).toBe("First hint");
  fireEvent.pointerEnter(second);
  expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  expect(screen.getByRole("tooltip").textContent).toBe("Second hint");
  fireEvent.keyDown(second, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focusIn(first);
  fireEvent.click(first);
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.focusIn(first);
  fireEvent.focusOut(first);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("does not reopen the profile tooltip when focus bubbles from a dialog portal", () => {
  render(
    <Tooltip label="Profile hint">
      <button>Profile</button>
      {createPortal(<button>Dialog field</button>, document.body)}
    </Tooltip>,
  );
  const field = screen.getByRole("button", { name: "Dialog field" });
  vi.spyOn(field, "matches").mockReturnValue(true);
  fireEvent.focusIn(field);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
