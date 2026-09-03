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
      elapsed: 0,
      pathPosition: 0,
      playing: false,
      trajectorySelected: false,
    });
  });
});
