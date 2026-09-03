"use client";

import { useEffect, useMemo } from "react";
import { LoaderCircle } from "lucide-react";

import { useCompiledTrajectoryQuery, useProjectQuery, type Vec3 } from "@/entities/project";
import { getAnchorLabel, useAddAnchor } from "@/features/anchor-creation";
import { ChatPanel, useSendChatMessage } from "@/features/chat-agent";
import { useEditorStore, useTrajectoryPlayback } from "@/features/project-editor";
import {
  useDeleteAnchor,
  useDeleteCameraKeyframe,
  useDeleteSpeedKeyframe,
} from "@/features/object-deletion";
import { SceneCanvas } from "@/widgets/scene-editor";
import { PlaybackControls, TrajectoryInspector } from "@/widgets/trajectory-panels";

import { ProjectHeader } from "./project-header";

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const projectQuery = useProjectQuery(projectId);
  const trajectoryQuery = useCompiledTrajectoryQuery(projectId);
  const addAnchorMutation = useAddAnchor(projectId);
  const deleteAnchorMutation = useDeleteAnchor(projectId);
  const deleteSpeedKeyframeMutation = useDeleteSpeedKeyframe(projectId);
  const deleteCameraKeyframeMutation = useDeleteCameraKeyframe(projectId);
  const chatMutation = useSendChatMessage(projectId);
  const project = projectQuery.data;
  const trajectory = trajectoryQuery.data ?? null;
  const trajectorySelected = useEditorStore((state) => state.trajectorySelected);
  const closeTrajectory = useEditorStore((state) => state.closeTrajectory);
  const resetEditor = useEditorStore((state) => state.resetEditor);
  const selectTrajectory = useEditorStore((state) => state.selectTrajectory);
  const playback = useTrajectoryPlayback(trajectory);
  const anchors = useMemo(() => project ? Object.values(project.anchors) : [], [project]);
  const mutating = addAnchorMutation.isPending
    || deleteAnchorMutation.isPending
    || deleteSpeedKeyframeMutation.isPending
    || deleteCameraKeyframeMutation.isPending
    || chatMutation.isPending;
  const requestError = projectQuery.error
    ?? trajectoryQuery.error
    ?? addAnchorMutation.error
    ?? deleteAnchorMutation.error
    ?? deleteSpeedKeyframeMutation.error
    ?? deleteCameraKeyframeMutation.error
    ?? chatMutation.error;
  const error = requestError instanceof Error ? requestError.message : null;

  useEffect(() => {
    resetEditor();
  }, [projectId, resetEditor]);

  async function addAnchor(position: Vec3, normal: Vec3, lift: number) {
    if (!project || mutating) return;
    await addAnchorMutation.mutateAsync({
      label: getAnchorLabel(Object.values(project.anchors)),
      surface_position: position.map((value) => Number(value.toFixed(4))) as Vec3,
      surface_normal: normal.map((value) => Number(value.toFixed(4))) as Vec3,
      lift: Number(lift.toFixed(4)),
      lift_axis: "world_up",
    }).catch(() => undefined);
  }

  async function sendMessage(message: string) {
    if (!project || mutating) return;
    try {
      const result = await chatMutation.mutateAsync(message);
      if (result.compiled.position_segments.length > 0) selectTrajectory();
    } catch {
      // The mutation exposes the error to the chat panel and rolls back its optimistic message.
    }
  }

  function deleteAnchor(anchorId: string, anchorLabel: string) {
    if (!window.confirm(`Delete anchor “${anchorLabel}”?`)) return;
    deleteAnchorMutation.mutate(anchorId);
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
          <SceneCanvas
            anchors={anchors}
            busy={mutating}
            onAddAnchor={(position, normal, lift) => void addAnchor(position, normal, lift)}
            onDeleteAnchor={(anchor) => deleteAnchor(anchor.id, anchor.label)}
            onSelectTrajectory={selectTrajectory}
            pathPosition={playback.pathPosition}
            selected={trajectorySelected}
            trajectory={trajectory}
          />
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
        {trajectorySelected && trajectory && trajectory.position_segments.length > 0 && (
          <TrajectoryInspector
            deletingAimKeyframeId={deleteCameraKeyframeMutation.variables}
            deletingSpeedKeyframeId={deleteSpeedKeyframeMutation.variables}
            onClose={closeTrajectory}
            onDeleteAimKeyframe={deleteCameraKeyframe}
            onDeleteSpeedKeyframe={deleteSpeedKeyframe}
            pathPosition={playback.pathPosition}
            project={project}
            trajectory={trajectory}
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
