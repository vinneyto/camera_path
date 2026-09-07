import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => useEditorStore.getState().resetEditor());

  it("keeps shared playback and selection state together", () => {
    useEditorStore.getState().setPlaybackFrame(0.4, 2.5);
    useEditorStore.getState().setPlaying(true);
    useEditorStore.getState().selectTrajectory();
    useEditorStore.getState().setActiveTool("anchor");

    expect(useEditorStore.getState()).toMatchObject({
      elapsed: 2.5,
      activeTool: "anchor",
      hoveredAnchorId: null,
      pathPosition: 0.4,
      playing: true,
      trajectorySelected: true,
    });
  });

  it("keeps one hovered anchor and ignores stale pointer-out events", () => {
    useEditorStore.getState().hoverAnchor("anchor-a");
    useEditorStore.getState().hoverAnchor("anchor-b");
    useEditorStore.getState().clearHoveredAnchor("anchor-a");

    expect(useEditorStore.getState().hoveredAnchorId).toBe("anchor-b");

    useEditorStore.getState().clearHoveredAnchor("anchor-b");
    expect(useEditorStore.getState().hoveredAnchorId).toBeNull();
  });

  it("resets project-scoped editor state", () => {
    useEditorStore.getState().setPlaybackFrame(0.8, 7);
    useEditorStore.getState().setPlaying(true);
    useEditorStore.getState().selectTrajectory();
    useEditorStore.getState().hoverAnchor("anchor-a");
    useEditorStore.getState().setActiveTool("anchor");
    useEditorStore.getState().resetEditor();

    expect(useEditorStore.getState()).toMatchObject({
      elapsed: 0,
      activeTool: null,
      hoveredAnchorId: null,
      pathPosition: 0,
      playing: false,
      trajectorySelected: false,
    });
  });
});
