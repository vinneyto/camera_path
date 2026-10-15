import { expect, it } from "vitest";
import { inspectSource } from "./check-boundaries.mjs";
const base = "/workspace/frontend";
const feature = `${base}/packages/features/anchors/src/view.tsx`;
const host = `${base}/apps/host/src/view.tsx`;
const sibling = `${base}/packages/features/lidar/src/index.ts`;
const hostModule = `${base}/apps/host/src/private.ts`;
const entry = `${base}/packages/features/anchors/src/index.ts`;
it.each([
  'import type { X } from "other";',
  'export { X } from "other";',
  'const module = import("other");',
  'const module = require("other");',
])("rejects a sibling feature dependency in %s", (text) => {
  expect(inspectSource(feature, text, () => sibling).join()).toContain(
    "must not import one another",
  );
});
it("rejects feature-to-host and shared-to-feature dependencies", () => {
  expect(
    inspectSource(
      feature,
      'import {x} from "../../host";',
      () => hostModule,
    ).join(),
  ).toContain("must not import the host");
  expect(
    inspectSource(
      `${base}/packages/store/src/view.ts`,
      'import {x} from "other";',
      () => sibling,
    ).join(),
  ).toContain("must not import features");
});
it("allows slot objects only in the catalog and rejects component/private imports", () => {
  const catalog = `${base}/apps/host/src/composition/feature-slots.ts`;
  expect(
    inspectSource(
      catalog,
      'import {slots as anchors} from "feature";',
      () => entry,
    ),
  ).toEqual([]);
  expect(
    inspectSource(host, 'import {slots} from "feature";', () => entry).join(),
  ).toContain("only slots objects");
  expect(
    inspectSource(
      catalog,
      'import {AnchorsScene} from "feature";',
      () => entry,
    ).join(),
  ).toContain("only slots objects");
  expect(
    inspectSource(
      catalog,
      'import {slots} from "feature/private";',
      () => feature,
    ).join(),
  ).toContain("public package entrypoint");
});
it("keeps feature entrypoints limited to slot objects and slot runtime in the host", () => {
  expect(inspectSource(entry, "export const slots = {};")).toEqual([]);
  expect(
    inspectSource(
      entry,
      'export {Component} from "./view";',
      () => feature,
    ).join(),
  ).toContain("only their slots object");
  expect(
    inspectSource(feature, 'import {Slot} from "@camera-path/slots";').join(),
  ).toContain("only slot types");
  expect(
    inspectSource(
      feature,
      'import type {FeatureSlots} from "@camera-path/slots";',
    ),
  ).toEqual([]);
});
it("allows a feature to use its own implementation and shared store", () => {
  expect(
    inspectSource(feature, 'import {x} from "./model";', () => feature),
  ).toEqual([]);
  expect(
    inspectSource(
      feature,
      'import {useEditorStore} from "store";',
      () => `${base}/packages/store/src/index.ts`,
    ),
  ).toEqual([]);
});
