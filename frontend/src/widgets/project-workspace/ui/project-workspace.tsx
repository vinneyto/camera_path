"use client";

import { useMemo } from "react";
import { LoaderCircle, MousePointerClick } from "lucide-react";

import { useCompiledTrajectoryQuery, useProjectQuery, type Vec3 } from "@/entities/project";
import { getAnchorLabel, useAddAnchor } from "@/features/anchor-creation";
import { useUpdateAnchor } from "@/features/anchor-editing";
import { ChatPanel, useSendChatMessage } from "@/features/chat-agent";
import {
  useAnchorToolShortcut,
  useActiveEditorTool,
  useCameraMode,
  useTrajectorySelection,
  useTrajectoryPlayback,
} from "@/features/project-editor";
import {
  useDeleteAnchor,
  useDeleteCameraKeyframe,
  useDeleteSpeedKeyframe,
} from "@/features/object-deletion";
import { SceneViewport, SceneWebGpuViewport } from "@/widgets/scene-editor";
import { PlaybackControls, TrajectoryInspector } from "@/widgets/trajectory-panels";

import { ProjectHeader } from "./project-header";
import { useElementHeight } from "./use-element-height";

interface ProjectWorkspaceProps {
  projectId: string;
  rendererBackend?: "webgl" | "webgpu";
}

const TRAJECTORY_INSPECTOR_BOTTOM_INSET = 12;

export function ProjectWorkspace({ projectId, rendererBackend = "webgpu" }: ProjectWorkspaceProps) {
  const projectQuery = useProjectQuery(projectId);
  const trajectoryQuery = useCompiledTrajectoryQuery(projectId);
  const addAnchorMutation = useAddAnchor(projectId);
  const updateAnchorMutation = useUpdateAnchor(projectId);
  const deleteAnchorMutation = useDeleteAnchor(projectId);
  const deleteSpeedKeyframeMutation = useDeleteSpeedKeyframe(projectId);
  const deleteCameraKeyframeMutation = useDeleteCameraKeyframe(projectId);
  const chatMutation = useSendChatMessage(projectId);
  const project = projectQuery.data;
  const trajectory = trajectoryQuery.data ?? null;
  const activeTool = useActiveEditorTool();
  const { cameraMode } = useCameraMode();
  const { closeTrajectory, selectTrajectory, trajectorySelected } = useTrajectorySelection();
  const playback = useTrajectoryPlayback(trajectory);
  const anchors = useMemo(() => project ? Object.values(project.anchors) : [], [project]);
  const trajectoryInspectorOpen = Boolean(
    trajectorySelected && trajectory && trajectory.position_segments.length > 0,
  );
  const { elementRef: trajectoryInspectorRef, height: trajectoryInspectorHeight } = useElementHeight(
    trajectoryInspectorOpen,
  );
  const bottomOverlayHeight = trajectoryInspectorOpen
    ? trajectoryInspectorHeight + TRAJECTORY_INSPECTOR_BOTTOM_INSET
    : 0;
  const mutating = addAnchorMutation.isPending
    || updateAnchorMutation.isPending
    || deleteAnchorMutation.isPending
    || deleteSpeedKeyframeMutation.isPending
    || deleteCameraKeyframeMutation.isPending
    || chatMutation.isPending;
  const requestError = projectQuery.error
    ?? trajectoryQuery.error
    ?? addAnchorMutation.error
    ?? updateAnchorMutation.error
    ?? deleteAnchorMutation.error
    ?? deleteSpeedKeyframeMutation.error
    ?? deleteCameraKeyframeMutation.error
    ?? chatMutation.error;
  const error = requestError instanceof Error ? requestError.message : null;
  const Viewport = rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;
  useAnchorToolShortcut();

  async function addAnchor(position: Vec3, normal: Vec3) {
    if (!project || mutating) return;
    await addAnchorMutation.mutateAsync({
      label: getAnchorLabel(Object.values(project.anchors)),
      surface_position: position.map((value) => Number(value.toFixed(4))) as Vec3,
      surface_normal: normal.map((value) => Number(value.toFixed(4))) as Vec3,
      lift: 0.5,
      lift_axis: "world_up",
    }).catch(() => undefined);
  }

  async function sendMessage(id: string, message: string, onAccepted: () => void) {
    if (!project || mutating) return;
    try {
      const result = await chatMutation.mutateAsync({
        id,
        message,
        onAccepted,
      });
      if (result.compiled.position_segments.length > 0) selectTrajectory();
    } catch {
      // The mutation exposes the error while the persisted user message stays in chat history.
    }
  }

  function deleteAnchor(anchorId: string) {
    deleteAnchorMutation.mutate(anchorId);
  }

  async function updateAnchorLift(anchorId: string, lift: number) {
    await updateAnchorMutation.mutateAsync({ anchorId, lift }).catch(() => undefined);
  }

  function deleteSpeedKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this speed keyframe?")) return;
    deleteSpeedKeyframeMutation.mutate(keyframeId);
  }

  function deleteCameraKeyframe(keyframeId: string) {
    if (!window.confirm("Delete this camera aim keyframe?")) return;
    deleteCameraKeyframeMutation.mutate(keyframeId);
  }

  if (projectQuery.isPending || trajectoryQuery.isPending) {
    return (
      <main className="flex h-screen items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex h-screen items-center justify-center p-6 text-xs text-destructive">
        {error ?? "Project not found"}
      </main>
    );
  }

  return (
    <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader project={project} />
        <div className="relative min-h-[260px] flex-1">
          <Viewport
            anchors={anchors}
            bottomOverlayHeight={bottomOverlayHeight}
            onAddAnchor={(position, normal) => void addAnchor(position, normal)}
            onDeleteAnchor={(anchor) => deleteAnchor(anchor.id)}
            onSelectTrajectory={selectTrajectory}
            onUpdateAnchorLift={updateAnchorLift}
            pathPosition={playback.pathPosition}
            selected={trajectorySelected}
            trajectory={trajectory}
          />
          {cameraMode === "orbit" && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
              {mutating
                ? <LoaderCircle className="size-3 animate-spin" />
                : <MousePointerClick className="size-3" />}
              {activeTool === "anchor"
                ? "Anchor tool active — release the modifier key to exit"
                : activeTool === "anchor-height"
                  ? "Drag vertically to set anchor height; press Escape to cancel"
                  : "Hold Command on macOS or Ctrl on Windows/Linux; tap on touchscreens"}
            </div>
          )}
          {trajectoryInspectorOpen && trajectory && (
            <div
              className="absolute left-3 right-3 z-30"
              ref={trajectoryInspectorRef}
              style={{ bottom: TRAJECTORY_INSPECTOR_BOTTOM_INSET }}
            >
              <TrajectoryInspector
                deletingAimKeyframeId={deleteCameraKeyframeMutation.variables}
                deletingSpeedKeyframeId={deleteSpeedKeyframeMutation.variables}
                onClose={closeTrajectory}
                onDeleteAimKeyframe={deleteCameraKeyframe}
                onDeleteSpeedKeyframe={deleteSpeedKeyframe}
                onScrub={playback.seek}
                pathPosition={playback.pathPosition}
                project={project}
                trajectory={trajectory}
              />
            </div>
          )}
        </div>
        {trajectory && trajectory.position_segments.length > 0 && (
          <PlaybackControls
            duration={playback.duration}
            elapsed={playback.elapsed}
            onSeek={playback.seek}
            onToggle={playback.toggle}
            pathPosition={playback.pathPosition}
            playing={playback.playing}
          />
        )}
      </div>
      <ChatPanel
        anchors={anchors}
        error={error}
        messages={project.chat_history}
        onSend={sendMessage}
        pending={mutating}
      />
    </main>
  );
}
