import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "./editor-store";

describe("editor store", () => {
  beforeEach(() => useEditorStore.getState().resetEditor());

  it("keeps shared playback and selection state together", () => {
    useEditorStore.getState().setPlaybackFrame(0.4, 2.5);
    useEditorStore.getState().setPlaying(true);
    useEditorStore.getState().selectTrajectory();

    expect(useEditorStore.getState()).toMatchObject({
      elapsed: 2.5,
      pathPosition: 0.4,
      playing: true,
      trajectorySelected: true,
    });
  });

  it("resets project-scoped editor state", () => {
    useEditorStore.getState().setPlaybackFrame(0.8, 7);
    useEditorStore.getState().setPlaying(true);
    useEditorStore.getState().selectTrajectory();
    useEditorStore.getState().resetEditor();

    expect(useEditorStore.getState()).toMatchObject({
      anchorPlacementMode: "inactive",
      anchorPlacementPhase: "surface",
      elapsed: 0,
      pathPosition: 0,
      playing: false,
      trajectorySelected: false,
    });
  });

  it("supports held and pinned anchor placement modes", () => {
    useEditorStore.getState().setAnchorPlacementShiftHeld(true);
    expect(useEditorStore.getState().anchorPlacementMode).toBe("held");

    useEditorStore.getState().toggleAnchorPlacementPinned();
    expect(useEditorStore.getState().anchorPlacementMode).toBe("pinned");

    useEditorStore.getState().setAnchorPlacementShiftHeld(true);
    useEditorStore.getState().setAnchorPlacementShiftHeld(false);
    expect(useEditorStore.getState().anchorPlacementMode).toBe("pinned");

    useEditorStore.getState().toggleAnchorPlacementPinned();
    expect(useEditorStore.getState().anchorPlacementMode).toBe("inactive");
  });

  it("prevents trajectory selection while placing anchors", () => {
    useEditorStore.getState().setAnchorPlacementShiftHeld(true);
    useEditorStore.getState().selectTrajectory();
    expect(useEditorStore.getState().trajectorySelected).toBe(false);
  });
});
