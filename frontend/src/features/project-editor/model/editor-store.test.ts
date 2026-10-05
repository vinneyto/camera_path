import { beforeEach, describe, expect, it } from "vitest";
import type { LibraryAsset } from "@/shared/api/generated/model";

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
      tool: { activeTool: "anchor", hoveredObject: null },
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
      tool: { activeTool: null, hoveredObject: null },
    });

    store.getState().playbackActions.setPlaying(false);
    store.getState().cameraActions.setCameraMode("orbit");
    expect(store.getState()).toMatchObject({
      camera: { cameraMode: "orbit" },
      playback: { elapsed: 2.5, pathPosition: 0.4, playing: false },
    });
  });

  it("preserves the expanded trajectory panel state across camera modes", () => {
    store.getState().selectionActions.selectTrajectory();

    store.getState().cameraActions.setCameraMode("trajectory");
    expect(store.getState().selection.trajectorySelected).toBe(true);

    store.getState().cameraActions.setCameraMode("orbit");
    expect(store.getState().selection.trajectorySelected).toBe(true);
  });

  it("keeps one hovered anchor and ignores stale pointer-out events", () => {
    store.getState().toolActions.hoverAnchor("anchor-a");
    store.getState().toolActions.hoverAnchor("anchor-b");
    store.getState().toolActions.clearHoveredAnchor("anchor-a");

    expect(store.getState().tool.hoveredObject).toEqual({
      id: "anchor-b",
      type: "anchor",
    });

    store.getState().toolActions.clearHoveredAnchor("anchor-b");
    expect(store.getState().tool.hoveredObject).toBeNull();
  });

  it("keeps one hovered editor object across anchors and the trajectory", () => {
    store.getState().toolActions.hoverAnchor("anchor-a");
    store.getState().toolActions.hoverTrajectory();
    store.getState().toolActions.clearHoveredAnchor("anchor-a");

    expect(store.getState().tool.hoveredObject).toEqual({ type: "trajectory" });

    store.getState().toolActions.clearHoveredTrajectory();
    expect(store.getState().tool.hoveredObject).toBeNull();
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
      tool: { activeTool: null, hoveredObject: null },
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
