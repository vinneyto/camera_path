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
it("allows public feature components without props, rejects props, spreads, injected children and private imports", () => {
  const imports = 'import { AnchorsScene as Scene } from "feature";';
  expect(
    inspectSource(host, imports + "const v = <Scene />;", () => entry),
  ).toEqual([]);
  for (const jsx of [
    "<Scene data={1} />",
    "<Scene {...data} />",
    "<Scene><div /></Scene>",
  ])
    expect(
      inspectSource(host, imports + `const v = ${jsx};`, () => entry).join(),
    ).toMatch(/without props|inject children/);
  expect(
    inspectSource(host, imports + "const v = <Scene />;", () => feature).join(),
  ).toContain("public package entrypoint");
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
