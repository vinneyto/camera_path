import { createEditorStore } from "@camera-path/store";
import type { LibraryAsset } from "@camera-path/types/api";
import { expect, it } from "vitest";
import { createEditorActions } from "./create-editor-actions";
it("isolates two projects and guards against stale pointer-out clearing another object's selection", () => {
  const first = createEditorStore(),
    second = createEditorStore();
  const actions = createEditorActions(first);
  actions.hoverObject({ id: "anchor:a" });
  actions.hoverObject({ id: "anchor:b" });
  actions.hoverObject({ id: null, ifCurrentId: "anchor:a" });
  actions.selectObject({ id: "trajectory" });
  actions.selectObject({ id: null, ifCurrentId: "anchor:b" });
  expect(first.getState().sceneInteraction).toEqual({
    hoveredObjectId: "anchor:b",
    selectedObjectId: "trajectory",
  });
  expect(second.getState().sceneInteraction).toEqual({
    hoveredObjectId: null,
    selectedObjectId: null,
  });
});
it("cancels pending placement when entering trajectory camera mode", () => {
  const store = createEditorStore();
  const actions = createEditorActions(store);
  actions.startCloudPlacement({ id: "asset" } as LibraryAsset);
  actions.hoverObject({ id: "anchor:a" });
  actions.setCameraMode("trajectory");
  expect(store.getState().tool).toEqual({
    activeTool: null,
    pendingCloud: null,
  });
  expect(store.getState().sceneInteraction.hoveredObjectId).toBeNull();
  actions.setActiveTool(null);
  expect(store.getState().tool.pendingCloud).toBeNull();
});
