"use client";

import { LoaderCircle, MousePointerClick } from "lucide-react";

import { type Project, type Vec3 } from "@/entities/project";
import { useListProjectClouds } from "@/shared/api/generated/client";
import type { ProjectCloud } from "@/shared/api/generated/model";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { getAnchorLabel, useAddAnchor } from "@/features/anchor-creation";
import { useUpdateAnchor } from "@/features/anchor-editing";
import {
  useActiveEditorTool,
  useAnchorToolShortcut,
  useCameraMode,
  useTrajectoryPlayback,
} from "@/features/project-editor";
import { useDeleteAnchor } from "@/features/object-deletion";
import { useProjectCloudActions } from "@/features/project-clouds/api/use-project-cloud-actions";
import { SceneViewport, SceneWebGpuViewport } from "@/widgets/scene-editor";

interface SceneViewportContainerProps {
  bottomOverlayHeight: number;
  deletingTrajectory: boolean;
  onDeleteTrajectory: () => void;
  onSelectTrajectory: () => void;
  project: Project;
  projectId: string;
  rendererBackend: "webgl" | "webgpu";
  selected: boolean;
  trajectory: CompiledTrajectory | null;
}

export function SceneViewportContainer({
  bottomOverlayHeight,
  deletingTrajectory,
  onDeleteTrajectory,
  onSelectTrajectory,
  project,
  projectId,
  rendererBackend,
  selected,
  trajectory,
}: SceneViewportContainerProps) {
  const addAnchorMutation = useAddAnchor(projectId);
  const updateAnchorMutation = useUpdateAnchor(projectId);
  const deleteAnchorMutation = useDeleteAnchor(projectId);
  const cloudActions = useProjectCloudActions(projectId);
  const activeTool = useActiveEditorTool();
  const { cameraMode } = useCameraMode();
  const playback = useTrajectoryPlayback(trajectory);
  const anchors = Object.values(project.anchors);
  const cloudsQuery = useListProjectClouds(projectId);
  const clouds = (cloudsQuery.data?.data ?? []) as ProjectCloud[];
  const mutating =
    addAnchorMutation.isPending ||
    updateAnchorMutation.isPending ||
    deleteAnchorMutation.isPending;
  const Viewport =
    rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;
  useAnchorToolShortcut();

  async function addAnchor(position: Vec3, normal: Vec3) {
    if (mutating) return;
    await addAnchorMutation
      .mutateAsync({
        label: getAnchorLabel(anchors),
        surface_position: position.map((value) =>
          Number(value.toFixed(4)),
        ) as Vec3,
        surface_normal: normal.map((value) => Number(value.toFixed(4))) as Vec3,
        lift: 0.5,
        lift_axis: "world_up",
      })
      .catch(() => undefined);
  }

  async function updateAnchorLift(anchorId: string, lift: number) {
    await updateAnchorMutation
      .mutateAsync({ anchorId, lift })
      .catch(() => undefined);
  }

  function addCloud(assetId: string, position: Vec3) {
    if (cloudActions.isPending) return;
    cloudActions.mutate({
      type: "add",
      assetId,
      translation: position.map((value) => Number(value.toFixed(4))) as Vec3,
    });
  }

  return (
    <>
      <Viewport
        anchors={anchors}
        clouds={clouds}
        bottomOverlayHeight={bottomOverlayHeight}
        deletingTrajectory={deletingTrajectory}
        onAddAnchor={(position, normal) => void addAnchor(position, normal)}
        onAddCloud={addCloud}
        onDeleteAnchor={(anchor) => deleteAnchorMutation.mutate(anchor.id)}
        onDeleteTrajectory={onDeleteTrajectory}
        onSelectTrajectory={onSelectTrajectory}
        onUpdateAnchorLift={updateAnchorLift}
        pathPosition={playback.pathPosition}
        selected={selected}
        trajectory={trajectory}
      />
      {cameraMode === "orbit" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
          {mutating ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <MousePointerClick className="size-3" />
          )}
          {activeTool === "anchor"
            ? "Anchor tool active — release the modifier key to exit"
            : activeTool === "cloud"
              ? "Click to place cloud on the surface; press Escape to cancel"
              : activeTool === "anchor-height"
                ? "Drag vertically to set anchor height; press Escape to cancel"
                : "Hold Command on macOS or Ctrl on Windows/Linux; tap on touchscreens"}
        </div>
      )}
      {cloudActions.error && (
        <div
          className="absolute left-3 top-12 rounded border bg-background px-2 py-1 text-xs text-destructive"
          role="alert"
        >
          {cloudActions.error.message}
        </div>
      )}
    </>
  );
}
