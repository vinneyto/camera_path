import { expect, it, vi } from "vitest";
import { FeaturePageRoute } from "./feature-page-route";

const pages = vi.hoisted(() => [
  { path: "/first", label: "First", icon: () => null, component: () => null },
  {
    path: "/tools/second",
    label: "Second",
    icon: () => null,
    component: () => null,
  },
]);
vi.mock("@host/composition/feature-pages", () => ({ featurePages: pages }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

it("renders either contributed page and keys its resource lifetime by path", () => {
  for (const page of pages) {
    const rendered = FeaturePageRoute({ path: page.path });
    expect(rendered.type).toBe(page.component);
    expect(rendered.key).toBe(page.path);
  }
});

it("uses Next's not-found boundary for an undeclared page", () => {
  expect(() => FeaturePageRoute({ path: "/first/unknown" })).toThrow(
    "NEXT_NOT_FOUND",
  );
});
