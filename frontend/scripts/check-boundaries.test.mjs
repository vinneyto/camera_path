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
      'import {usePlaybackState} from "store";',
      () => `${base}/packages/store/src/index.ts`,
    ),
  ).toEqual([]);
});
it.each([
  'import {useEditorStoreApi as raw} from "@camera-path/store";',
  'import {useEditorStore} from "@camera-path/store";',
  'import type {EditorState} from "@camera-path/store";',
  'import {createEditorStore} from "@camera-path/store";',
  'import * as store from "@camera-path/store";',
  'export {useEditorStoreApi} from "@camera-path/store";',
  'const raw = import("@camera-path/store");',
  'const raw = require("@camera-path/store");',
  'import {useEditorStoreApi} from "@camera-path/store/store-provider";',
  'import {useEditorStoreApi} from "aliased-store";',
])("rejects feature access to raw store/state in %s", (text) => {
  expect(
    inspectSource(
      feature,
      text,
      () => `${base}/packages/store/src/index.ts`,
    ).join(),
  ).toContain("public selector hooks only");
});
it("allows all four section hooks and scope hooks, including local aliases", () => {
  expect(
    inspectSource(
      feature,
      'import {useCameraState, usePlaybackState as playback, useEditorTool, useSceneInteraction, useUserSettings, useProjectId, useAssetId} from "@camera-path/store";',
      () => `${base}/packages/store/src/index.ts`,
    ),
  ).toEqual([]);
  expect(
    inspectSource(
      host,
      'import {useEditorStoreApi} from "@camera-path/store";',
      () => `${base}/packages/store/src/index.ts`,
    ),
  ).toEqual([]);
});
it("rejects private store paths and direct Zustand imports in features", () => {
  expect(
    inspectSource(
      feature,
      'import {usePlaybackState} from "private-store";',
      () => `${base}/packages/store/src/use-playback-state.ts`,
    ).join(),
  ).toContain("public selector hooks only");
  expect(
    inspectSource(
      feature,
      'import {useStore} from "zustand";',
      () => undefined,
    ).join(),
  ).toContain("instead of accessing Zustand directly");
});
