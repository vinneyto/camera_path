import type { FeaturePage } from "@camera-path/slots";
import { expect, it } from "vitest";
import { collectFeaturePages } from "./collect-feature-pages";

const first: FeaturePage = {
  path: "/first",
  label: "First",
  icon: () => null,
  component: () => null,
};
const second: FeaturePage = {
  ...first,
  path: "/tools/second",
  label: "Second",
};

it("collects pages in catalog order alongside native slot contributions", () => {
  expect(
    collectFeaturePages([
      { settings: { content: [() => null] } },
      { pages: [first] },
      {},
      { pages: [second] },
    ]),
  ).toEqual([first, second]);
});

it("rejects duplicate declarations across features", () => {
  expect(() =>
    collectFeaturePages([
      { pages: [first] },
      { pages: [{ ...second, path: first.path }] },
    ]),
  ).toThrow("Duplicate feature page path");
});

it.each([
  "/",
  "/library",
  "/library/example",
  "/jobs",
  "/jobs/one",
  "/projects",
  "/projects/one/viewer",
  "/api/v1",
  "/_next/static",
  "/first/",
  "/first?x=1",
  "/first#hash",
  "/first/../other",
  "//host",
  "/First",
  "/first%2Fother",
] as const)("rejects native or ambiguous paths: %s", (path) => {
  expect(() =>
    collectFeaturePages([{ pages: [{ ...first, path }] }]),
  ).toThrow();
});

it("rejects an inaccessible empty navigation label", () => {
  expect(() =>
    collectFeaturePages([{ pages: [{ ...first, label: "  " }] }]),
  ).toThrow("label is empty");
});
