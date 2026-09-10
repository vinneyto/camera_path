"use client";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTrajectoryPlayback } from "@/features/project-editor";
import {
  useDeleteCameraKeyframe,
  useDeleteSpeedKeyframe,
} from "@/features/object-deletion";
import { TrajectoryInspector } from "@/widgets/trajectory-panels";

interface TrajectoryInspectorContainerProps {
  onClose: () => void;
  project: Project;
  projectId: string;
  trajectory: CompiledTrajectory;
}

export function TrajectoryInspectorContainer({
  onClose,
  project,
  projectId,
  trajectory,
}: TrajectoryInspectorContainerProps) {
  const playback = useTrajectoryPlayback(trajectory);
  const deleteSpeedKeyframeMutation = useDeleteSpeedKeyframe(projectId);
  const deleteCameraKeyframeMutation = useDeleteCameraKeyframe(projectId);

  function deleteSpeedKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this speed keyframe?")) return;
    deleteSpeedKeyframeMutation.mutate(keyframeId);
  }

  function deleteCameraKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this camera aim keyframe?")) return;
    deleteCameraKeyframeMutation.mutate(keyframeId);
  }

  return (
    <TrajectoryInspector
      deletingAimKeyframeId={deleteCameraKeyframeMutation.variables}
      deletingSpeedKeyframeId={deleteSpeedKeyframeMutation.variables}
      onClose={onClose}
      onDeleteAimKeyframe={deleteCameraKeyframe}
      onDeleteSpeedKeyframe={deleteSpeedKeyframe}
      onScrub={playback.seek}
      pathPosition={playback.pathPosition}
      project={project}
      trajectory={trajectory}
    />
  );
}
