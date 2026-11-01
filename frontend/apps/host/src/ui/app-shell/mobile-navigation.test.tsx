// @vitest-environment happy-dom
import { SlotProvider } from "@camera-path/slots";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MobileNavigation } from "./mobile-navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/library/cloud" }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  const listeners = new Set<() => void>();
  const desktop = {
    matches: false,
    addEventListener: (_name: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => desktop);
  render(
    <SlotProvider
      features={[{ profile: { account: [() => <p>Current account</p>] } }]}
    >
      <MobileNavigation />
    </SlotProvider>,
  );
  return { desktop, listeners };
}

it("opens the dropdown, highlights the current section and closes after navigation", async () => {
  mount();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(
    await screen.findByRole("dialog", { name: "Navigation" }),
  ).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "Projects" }),
  );
  const library = screen.getByRole("link", { name: "Library" });
  expect(library.getAttribute("aria-current")).toBe("page");
  fireEvent.click(library);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("opens the shared profile from the dropdown and returns to navigation after closing it", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Profile & settings" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Profile & settings" }),
  ).toBeTruthy();
  expect(screen.getByText("Current account")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeTruthy();
});

it("offers only the jobs list in mobile navigation and closes on selection", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const jobs = await screen.findByRole("link", { name: "Jobs" });
  expect(jobs.getAttribute("href")).toBe("/jobs");
  expect(screen.getAllByRole("link", { name: "Jobs" })).toHaveLength(1);
  fireEvent.click(jobs);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("closes the mobile dropdown when switching to a desktop width", async () => {
  const { desktop, listeners } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  await screen.findByRole("dialog", { name: "Navigation" });
  act(() => {
    desktop.matches = true;
    for (const listener of listeners) listener();
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});
