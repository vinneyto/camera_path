// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@camera-path/contracts/project";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";

import { ProjectScene } from "@host/ui/project-workspace/ui/project-scene";

const editorState = vi.hoisted(() => ({ trajectorySelected: false }));

vi.mock("@host/editor", () => ({
  useTrajectorySelection: () => ({
    closeTrajectory: vi.fn(),
    selectTrajectory: vi.fn(),
    trajectorySelected: editorState.trajectorySelected,
  }),
}));

vi.mock("@host/ui/project-workspace/ui/use-element-height", () => ({
  useElementHeight: () => ({ elementRef: { current: null }, height: 100 }),
}));

vi.mock("@host/ui/project-workspace/ui/scene-viewport-container", () => ({
  SceneViewportContainer: ({
    bottomOverlayHeight,
  }: {
    bottomOverlayHeight: number;
  }) => (
    <div
      data-bottom-overlay-height={bottomOverlayHeight}
      data-testid="scene-viewport"
    />
  ),
}));

vi.mock("@host/ui/project-workspace/ui/playback-controls-container", () => ({
  PlaybackControlsContainer: () => null,
}));

vi.mock("@host/ui/project-workspace/ui/trajectory-inspector-container", () => ({
  TrajectoryInspectorContainer: () => null,
}));

const project = { id: "project-1" } as Project;
const trajectory = {
  position_segments: [{}],
} as unknown as CompiledTrajectory;

describe("ProjectScene", () => {
  afterEach(() => {
    editorState.trajectorySelected = false;
    cleanup();
  });

  it("shifts the frustum only while trajectory controls are expanded", () => {
    const props = {
      deletingTrajectory: false,
      onDeleteTrajectory: vi.fn(),
      project,
      projectId: project.id,
      rendererBackend: "webgpu" as const,
      trajectory,
    };
    const { rerender } = render(<ProjectScene {...props} />);

    expect(screen.getByTestId("scene-viewport").dataset).toMatchObject({
      bottomOverlayHeight: "0",
    });

    editorState.trajectorySelected = true;
    rerender(<ProjectScene {...props} />);

    expect(screen.getByTestId("scene-viewport").dataset).toMatchObject({
      bottomOverlayHeight: "112",
    });
  });
});
