// @vitest-environment happy-dom
import { SlotProvider } from "@camera-path/slots";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
afterEach(cleanup);

it.each([
  ["/", "Projects"],
  ["/projects/scene", "Projects"],
  ["/library", "Library"],
  ["/library/cloud", "Library"],
  ["/jobs", "Jobs"],
  ["/jobs/job-1", "Jobs"],
  ["/sift", "SIFT lab"],
  ["/unknown", null],
])("highlights the current section at %s", (pathname, active) => {
  route.pathname = pathname;
  render(
    <SlotProvider features={[]}>
      <AppSidebar />
    </SlotProvider>,
  );
  const links = {
    Projects: "/",
    Library: "/library",
    Jobs: "/jobs",
    "SIFT lab": "/sift",
  };
  for (const [label, href] of Object.entries(links)) {
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("aria-current")).toBe(
      label === active ? "page" : null,
    );
    expect(link.getAttribute("href")).toBe(href);
  }
  expect(screen.getAllByRole("link", { name: "Jobs" })).toHaveLength(1);
});

it("opens account and settings contributions together from the persistent sidebar", async () => {
  render(
    <SlotProvider
      features={[
        {
          profile: { account: [() => <p>Current account</p>] },
          settings: {
            content: [
              () => (
                <label>
                  Show grid
                  <input type="checkbox" />
                </label>
              ),
            ],
          },
        },
      ]}
    >
      <AppSidebar />
    </SlotProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Profile & settings" }));
  expect(
    await screen.findByRole("dialog", { name: "Profile & settings" }),
  ).toBeTruthy();
  expect(screen.getByText("Current account")).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "Show grid" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
