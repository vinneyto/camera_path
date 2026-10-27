// @vitest-environment happy-dom
import { SlotProvider } from "@camera-path/slots";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NavigationLinks } from "./navigation-links";
import { MobileNavigation } from "./mobile-navigation";

vi.mock("@host/composition/feature-pages", () => ({
  featurePages: [
    {
      path: "/tools/demo",
      label: "Contributed demo",
      icon: () => <svg data-testid="demo-icon" />,
      component: () => null,
    },
  ],
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/tools/demo" }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows a second feature's icon, link and active state without a host button", () => {
  render(<NavigationLinks />);
  const link = screen.getByRole("link", { name: "Contributed demo" });
  expect(link.getAttribute("href")).toBe("/tools/demo");
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(screen.getByTestId("demo-icon")).toBeTruthy();
});

it("uses the same declaration in mobile navigation and closes on selection", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  render(
    <SlotProvider features={[]}>
      <MobileNavigation />
    </SlotProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const link = await screen.findByRole("link", { name: "Contributed demo" });
  expect(link.getAttribute("href")).toBe("/tools/demo");
  expect(link.getAttribute("aria-current")).toBe("page");
  fireEvent.click(link);
  expect(screen.queryByRole("dialog")).toBeNull();
});
