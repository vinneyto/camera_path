import type { LibraryAsset } from "@camera-path/contracts/api";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createEditorStore,
  type EditorStoreApi,
} from "@host/editor/model/editor-store";

describe("editor store", () => {
  let store: EditorStoreApi;

  beforeEach(() => {
    store = createEditorStore();
  });

  it("keeps camera, tool, selection, and playback in explicit slices", () => {
    store.getState().playbackActions.setPlaybackFrame(0.4, 2.5);
    store.getState().playbackActions.setPlaying(true);
    store.getState().sceneInteractionActions.selectObject({ id: "trajectory" });
    store.getState().toolActions.setActiveTool("anchor");

    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: true },
      sceneInteraction: {
        selectedObjectId: "trajectory",
        hoveredObjectId: null,
      },
      tool: { activeTool: "anchor" },
    });
  });

  it("switches camera mode without changing playback", () => {
    store.getState().playbackActions.setPlaybackFrame(0.4, 2.5);
    store.getState().playbackActions.setPlaying(true);
    store
      .getState()
      .sceneInteractionActions.hoverObject({ id: "anchor:anchor-a" });
    store.getState().toolActions.setActiveTool("anchor");
    store.getState().cameraActions.setCameraMode("trajectory");

    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "trajectory" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: true },
      tool: { activeTool: null },
      sceneInteraction: { hoveredObjectId: null },
    });

    store.getState().playbackActions.setPlaying(false);
    store.getState().cameraActions.setCameraMode("orbit");
    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: false },
    });
  });

  it("preserves the expanded trajectory panel state across camera modes", () => {
    store.getState().sceneInteractionActions.selectObject({ id: "trajectory" });

    store.getState().cameraActions.setCameraMode("trajectory");
    expect(store.getState().sceneInteraction.selectedObjectId).toBe(
      "trajectory",
    );

    store.getState().cameraActions.setCameraMode("orbit");
    expect(store.getState().sceneInteraction.selectedObjectId).toBe(
      "trajectory",
    );
  });

  it("keeps one hovered anchor and ignores stale pointer-out events", () => {
    store
      .getState()
      .sceneInteractionActions.hoverObject({ id: "anchor:anchor-a" });
    store
      .getState()
      .sceneInteractionActions.hoverObject({ id: "anchor:anchor-b" });
    store.getState().sceneInteractionActions.hoverObject({
      id: null,
      ifCurrentId: "anchor:anchor-a",
    });

    expect(store.getState().sceneInteraction.hoveredObjectId).toBe(
      "anchor:anchor-b",
    );

    store.getState().sceneInteractionActions.hoverObject({
      id: null,
      ifCurrentId: "anchor:anchor-b",
    });
    expect(store.getState().sceneInteraction.hoveredObjectId).toBeNull();
  });

  it("keeps one hovered editor object across anchors and the trajectory", () => {
    store
      .getState()
      .sceneInteractionActions.hoverObject({ id: "anchor:anchor-a" });
    store.getState().sceneInteractionActions.hoverObject({ id: "trajectory" });
    store.getState().sceneInteractionActions.hoverObject({
      id: null,
      ifCurrentId: "anchor:anchor-a",
    });

    expect(store.getState().sceneInteraction.hoveredObjectId).toBe(
      "trajectory",
    );

    store.getState().sceneInteractionActions.hoverObject({
      id: null,
      ifCurrentId: "trajectory",
    });
    expect(store.getState().sceneInteraction.hoveredObjectId).toBeNull();
  });

  it("ignores a late trajectory leave after an anchor takes hover", () => {
    const actions = store.getState().sceneInteractionActions;
    actions.hoverObject({ id: "trajectory" });
    actions.hoverObject({ id: "anchor:a" });
    actions.hoverObject({ id: null, ifCurrentId: "trajectory" });
    expect(store.getState().sceneInteraction.hoveredObjectId).toBe("anchor:a");
  });

  it("keeps one selected ID and ignores cleanup for a previously selected object", () => {
    const actions = store.getState().sceneInteractionActions;
    actions.selectObject({ id: "trajectory" });
    actions.selectObject({ id: "anchor:a" });
    actions.selectObject({ id: null, ifCurrentId: "trajectory" });
    expect(store.getState().sceneInteraction.selectedObjectId).toBe("anchor:a");
    actions.selectObject({ id: null, ifCurrentId: "anchor:a" });
    expect(store.getState().sceneInteraction.selectedObjectId).toBeNull();
  });

  it("clears only the deleted object's hover and selection", () => {
    const actions = store.getState().sceneInteractionActions;
    actions.hoverObject({ id: "anchor:b" });
    actions.selectObject({ id: "anchor:a" });
    actions.hoverObject({ id: null, ifCurrentId: "anchor:a" });
    actions.selectObject({ id: null, ifCurrentId: "anchor:a" });
    expect(store.getState().sceneInteraction).toEqual({
      hoveredObjectId: "anchor:b",
      selectedObjectId: null,
    });
  });

  it("creates isolated editor sessions", () => {
    const otherStore = createEditorStore();
    store.getState().cameraActions.setCameraMode("trajectory");
    store.getState().toolActions.setActiveTool("anchor");
    store.getState().sceneInteractionActions.selectObject({ id: "trajectory" });

    expect(otherStore.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 0, pathPosition: 0, playing: false },
      sceneInteraction: { selectedObjectId: null, hoveredObjectId: null },
      tool: { activeTool: null },
    });
  });

  it("keeps a pending cloud until cancellation, then clears it", () => {
    const asset = { id: "asset", name: "Cloud" } as LibraryAsset;
    store.getState().toolActions.startCloudPlacement(asset);
    expect(store.getState().tool).toMatchObject({
      activeTool: "cloud",
      pendingCloud: { id: "asset" },
    });
    store.getState().toolActions.setActiveTool(null);
    expect(store.getState().tool).toMatchObject({
      activeTool: null,
      pendingCloud: null,
    });
  });
});
