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
    widget: "position",
  });
  expect(second.getState().sceneInteraction).toEqual({
    hoveredObjectId: null,
    selectedObjectId: null,
    widget: "position",
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
it("switches widget mode independently and releases only the transform tool", () => {
  const store = createEditorStore();
  const actions = createEditorActions(store);
  actions.selectObject({ id: "model" });
  actions.setSceneWidget("rotation");
  expect(store.getState().sceneInteraction).toEqual({
    hoveredObjectId: null,
    selectedObjectId: "model",
    widget: "rotation",
  });
  actions.setActiveTool("object-transform");
  actions.finishObjectTransform();
  expect(store.getState().tool.activeTool).toBeNull();
  actions.setActiveTool("anchor");
  actions.finishObjectTransform();
  expect(store.getState().tool.activeTool).toBe("anchor");
});

it("adds named selections once and anchor references repeatedly without changing selection", () => {
  const store = createEditorStore();
  const other = createEditorStore();
  const actions = createEditorActions(store);
  actions.changeChatMessage("Replace");
  actions.selectObject({ id: "model", name: "Chair 01" });
  actions.selectObject({ id: "model", name: "Chair 01" });
  actions.hoverObject({ id: "anchor:a" });
  expect(store.getState().chatComposer.message).toBe("Replace @Chair 01 ");
  actions.referenceChatObject("A");
  actions.referenceChatObject("A");
  expect(store.getState().sceneInteraction.selectedObjectId).toBe("model");
  expect(store.getState().chatComposer.message).toBe(
    "Replace @Chair 01 @A @A ",
  );
  actions.selectObject({ id: null, ifCurrentId: "other" });
  expect(store.getState().sceneInteraction.selectedObjectId).toBe("model");
  actions.selectObject({ id: null });
  actions.selectObject({ id: "model", name: "Chair 01" });
  expect(store.getState().chatComposer.message).toBe(
    "Replace @Chair 01 @A @A @Chair 01 ",
  );
  expect(other.getState().chatComposer.message).toBe("");
});
