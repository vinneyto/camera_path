"use client";
import { EditorOnly } from "@host/ui/header";

import { LoaderCircle, MousePointerClick } from "lucide-react";
import { useState } from "react";
import { useEditorStoreApi } from "@host/editor/model/editor-store-provider";

import type { ProjectCloud } from "@camera-path/contracts/api";
import {
  getAnchorLabel,
  useAddAnchor,
  useUpdateAnchor,
} from "@camera-path/feature-anchors";
import { useProjectCloudActions } from "@camera-path/feature-scene-models";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";
import { useListProjectClouds } from "@host/adapters/api/generated/client";
import { useDeleteAnchor } from "@host/adapters/deletions";
import { type Project, type Vec3 } from "@host/adapters/project";
import {
  AnchorToolShortcut,
  useActiveEditorTool,
  useCameraMode,
  useTrajectoryPlayback,
} from "@host/editor";
import { SceneViewport, SceneWebGpuViewport } from "@host/ui/scene-editor";

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
  const store = useEditorStoreApi();
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
  const [initialCloudSnapshot, setInitialCloudSnapshot] = useState<{
    projectId: string;
    ids: string[];
  } | null>(null);
  if (cloudsQuery.isSuccess && initialCloudSnapshot?.projectId !== projectId)
    setInitialCloudSnapshot({
      projectId,
      ids: clouds.map((cloud) => cloud.id),
    });
  const initialCloudIds =
    initialCloudSnapshot?.projectId === projectId
      ? initialCloudSnapshot.ids
      : null;
  const mutating =
    addAnchorMutation.isPending ||
    updateAnchorMutation.isPending ||
    deleteAnchorMutation.isPending;
  const Viewport =
    rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;

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

  async function addCloud(assetId: string, position: Vec3): Promise<boolean> {
    if (cloudActions.isPending) return false;
    const response = await cloudActions.mutateAsync({
      type: "add",
      assetId,
      translation: position.map((value) => Number(value.toFixed(4))) as Vec3,
    });
    return response.status === 201;
  }

  return (
    <>
      <EditorOnly>
        <AnchorToolShortcut />
      </EditorOnly>
      <Viewport
        onScenePointerLeave={() =>
          store.getState().sceneInteractionActions.hoverObject({ id: null })
        }
        onScenePointerMissed={() => {
          if (store.getState().tool.activeTool === null)
            store.getState().sceneInteractionActions.selectObject({ id: null });
        }}
        key={projectId}
        lidar={project.camera_track.lidar_keyframe}
        anchors={anchors}
        clouds={clouds}
        initialCloudIds={initialCloudIds}
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
      <EditorOnly>
        {cameraMode === "orbit" && (
          <div className="pointer-events-none absolute left-3 top-3 hidden items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur md:flex">
            {mutating ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <MousePointerClick className="size-3" />
            )}
            {activeTool === "anchor"
              ? "Anchor tool active — release the modifier key to exit"
              : activeTool === "cloud"
                ? "Click to place cloud on a surface (origin if no hit); press Escape to cancel"
                : activeTool === "anchor-height"
                  ? "Drag vertically to set anchor height; press Escape to cancel"
                  : "Hold Command on macOS or Ctrl on Windows/Linux; tap on touchscreens"}
          </div>
        )}
      </EditorOnly>
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
