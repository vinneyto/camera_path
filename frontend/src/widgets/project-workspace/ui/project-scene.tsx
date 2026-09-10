"use client";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTrajectorySelection } from "@/features/project-editor";
import { FLOATING_PANEL_Z_INDEX } from "@/shared/ui";

import { PlaybackControlsContainer } from "./playback-controls-container";
import { SceneViewportContainer } from "./scene-viewport-container";
import { TrajectoryInspectorContainer } from "./trajectory-inspector-container";
import { useElementHeight } from "./use-element-height";

interface ProjectSceneProps {
  project: Project;
  projectId: string;
  rendererBackend: "webgl" | "webgpu";
  trajectory: CompiledTrajectory | null;
}

const TRAJECTORY_CONTROLS_BOTTOM_INSET = 12;

export function ProjectScene({
  project,
  projectId,
  rendererBackend,
  trajectory,
}: ProjectSceneProps) {
  const { closeTrajectory, selectTrajectory, trajectorySelected } = useTrajectorySelection();
  const trajectoryControlsAvailable = Boolean(trajectory && trajectory.position_segments.length > 0);
  const trajectoryControlsExpanded = trajectorySelected && trajectoryControlsAvailable;
  const { elementRef: trajectoryControlsRef, height: trajectoryControlsHeight } = useElementHeight(
    trajectoryControlsAvailable,
  );
  const bottomOverlayHeight = trajectoryControlsAvailable
    ? trajectoryControlsHeight + TRAJECTORY_CONTROLS_BOTTOM_INSET
    : 0;

  return (
    <div className="relative min-h-[260px] flex-1">
      <SceneViewportContainer
        bottomOverlayHeight={bottomOverlayHeight}
        onSelectTrajectory={selectTrajectory}
        project={project}
        projectId={projectId}
        rendererBackend={rendererBackend}
        selected={trajectorySelected}
        trajectory={trajectory}
      />
      {trajectoryControlsAvailable && trajectory && (
        <div
          className="absolute left-3 right-3 overflow-hidden rounded-lg border bg-background/90 shadow-lg backdrop-blur-md"
          ref={trajectoryControlsRef}
          style={{ bottom: TRAJECTORY_CONTROLS_BOTTOM_INSET, zIndex: FLOATING_PANEL_Z_INDEX }}
        >
          <PlaybackControlsContainer
            collapsed={!trajectoryControlsExpanded}
            onExpand={trajectoryControlsExpanded ? undefined : selectTrajectory}
            trajectory={trajectory}
          />
          {trajectoryControlsExpanded && (
            <TrajectoryInspectorContainer
              onClose={closeTrajectory}
              project={project}
              projectId={projectId}
              trajectory={trajectory}
            />
          )}
        </div>
      )}
    </div>
  );
}
