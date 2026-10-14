"use client";
import type { Project } from "@camera-path/contracts/project";
import { useAddDepthOfFieldKeyframe } from "@camera-path/feature-depth-of-field";
import { useLidarTimeline } from "@camera-path/feature-lidar";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";
import {
  useDeleteCameraKeyframe,
  useDeleteCameraOrientationKeyframe,
  useDeleteDepthOfFieldKeyframe,
  useDeleteSpeedKeyframe,
} from "@host/adapters/deletions";
import { useTrajectoryPlayback } from "@host/editor";
import { TrajectoryInspector } from "@host/ui/trajectory-panels";

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
  const lidarMutation = useLidarTimeline(projectId);
  const playback = useTrajectoryPlayback(trajectory);
  const addDepthOfFieldKeyframeMutation = useAddDepthOfFieldKeyframe(projectId);
  const deleteSpeedKeyframeMutation = useDeleteSpeedKeyframe(projectId);
  const deleteCameraKeyframeMutation = useDeleteCameraKeyframe(projectId);
  const deleteCameraOrientationKeyframeMutation =
    useDeleteCameraOrientationKeyframe(projectId);
  const deleteDepthOfFieldKeyframeMutation =
    useDeleteDepthOfFieldKeyframe(projectId);

  function deleteSpeedKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this speed keyframe?")) return;
    deleteSpeedKeyframeMutation.mutate(keyframeId);
  }

  function deleteCameraKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this camera aim keyframe?")) return;
    deleteCameraKeyframeMutation.mutate(keyframeId);
  }

  function deleteCameraOrientationKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this camera orientation keyframe?")) return;
    deleteCameraOrientationKeyframeMutation.mutate(keyframeId);
  }

  function deleteDepthOfFieldKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this depth of field keyframe?")) return;
    deleteDepthOfFieldKeyframeMutation.mutate(keyframeId);
  }

  return (
    <TrajectoryInspector
      onSetLidar={(settings) => lidarMutation.mutate(settings)}
      lidarPending={lidarMutation.isPending}
      lidarError={lidarMutation.error?.message}
      deletingAimKeyframeId={deleteCameraKeyframeMutation.variables}
      deletingOrientationKeyframeId={
        deleteCameraOrientationKeyframeMutation.variables
      }
      deletingSpeedKeyframeId={deleteSpeedKeyframeMutation.variables}
      deletingDepthOfFieldKeyframeId={
        deleteDepthOfFieldKeyframeMutation.variables
      }
      effectsPending={addDepthOfFieldKeyframeMutation.isPending}
      onAddDepthOfField={() =>
        addDepthOfFieldKeyframeMutation.mutate({
          path_position: playback.pathPosition,
          focus: { kind: "center_weighted_9" },
        })
      }
      onClose={onClose}
      onDeleteAimKeyframe={deleteCameraKeyframe}
      onDeleteOrientationKeyframe={deleteCameraOrientationKeyframe}
      onDeleteSpeedKeyframe={deleteSpeedKeyframe}
      onDeleteDepthOfFieldKeyframe={deleteDepthOfFieldKeyframe}
      onScrub={playback.seek}
      pathPosition={playback.pathPosition}
      project={project}
      trajectory={trajectory}
    />
  );
}
