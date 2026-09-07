import { beforeEach, describe, expect, it } from "vitest";

import { createEditorStore, type EditorStoreApi } from "./editor-store";

describe("editor store", () => {
  let store: EditorStoreApi;

  beforeEach(() => {
    store = createEditorStore();
  });

  it("keeps camera, tool, selection, and playback in explicit slices", () => {
    store.getState().playbackActions.setPlaybackFrame(0.4, 2.5);
    store.getState().playbackActions.setPlaying(true);
    store.getState().selectionActions.selectTrajectory();
    store.getState().toolActions.setActiveTool("anchor");

    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: true },
      selection: { trajectorySelected: true },
      tool: { activeTool: "anchor", hoveredAnchorId: null },
    });
  });

  it("switches camera mode without changing playback", () => {
    store.getState().playbackActions.setPlaybackFrame(0.4, 2.5);
    store.getState().playbackActions.setPlaying(true);
    store.getState().toolActions.hoverAnchor("anchor-a");
    store.getState().toolActions.setActiveTool("anchor");
    store.getState().cameraActions.setCameraMode("trajectory");

    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "trajectory" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: true },
      tool: { activeTool: null, hoveredAnchorId: null },
    });

    store.getState().playbackActions.setPlaying(false);
    store.getState().cameraActions.setCameraMode("orbit");
    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: false },
    });
  });

  it("keeps one hovered anchor and ignores stale pointer-out events", () => {
    store.getState().toolActions.hoverAnchor("anchor-a");
    store.getState().toolActions.hoverAnchor("anchor-b");
    store.getState().toolActions.clearHoveredAnchor("anchor-a");

    expect(store.getState().tool.hoveredAnchorId).toBe("anchor-b");

    store.getState().toolActions.clearHoveredAnchor("anchor-b");
    expect(store.getState().tool.hoveredAnchorId).toBeNull();
  });

  it("creates isolated editor sessions", () => {
    const otherStore = createEditorStore();
    store.getState().cameraActions.setCameraMode("trajectory");
    store.getState().toolActions.setActiveTool("anchor");
    store.getState().selectionActions.selectTrajectory();

    expect(otherStore.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 0, pathPosition: 0, playing: false },
      selection: { trajectorySelected: false },
      tool: { activeTool: null, hoveredAnchorId: null },
    });
  });
});
