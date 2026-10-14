"use client";
import { useAuth } from "@host/adapters/identity/auth-provider";
import { LoaderCircle } from "lucide-react";

import { useClearTrajectory } from "@host/adapters/deletions";
import {
  useCompiledTrajectoryQuery,
  useProjectQuery,
} from "@host/adapters/project";
import { useUserSettings } from "@host/adapters/settings";
import {
  TrajectoryPlaybackLoop,
  useHoveredTrajectory,
  useTrajectoryPlayback,
  useTrajectorySelection,
} from "@host/editor";

import { ChatPanelContainer } from "@host/ui/project-workspace/ui/chat-panel-container";
import { ProjectHeader } from "@host/ui/project-workspace/ui/project-header";
import { ProjectScene } from "@host/ui/project-workspace/ui/project-scene";

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { canEdit } = useAuth();
  const { webGpuTileRenderer, loading: settingsLoading } = useUserSettings();
  const projectQuery = useProjectQuery(projectId);
  const trajectoryQuery = useCompiledTrajectoryQuery(projectId);
  const project = projectQuery.data;
  const trajectory = trajectoryQuery.data ?? null;
  const clearTrajectoryMutation = useClearTrajectory(projectId);
  const { closeTrajectory } = useTrajectorySelection();
  const { clearHoveredTrajectory } = useHoveredTrajectory();
  const playback = useTrajectoryPlayback(trajectory);
  const queryError =
    projectQuery.error ??
    trajectoryQuery.error ??
    clearTrajectoryMutation.error;

  async function clearTrajectory() {
    if (clearTrajectoryMutation.isPending) return;
    try {
      await clearTrajectoryMutation.mutateAsync();
      closeTrajectory();
      clearHoveredTrajectory();
      playback.reset();
    } catch {
      // The mutation exposes the error through the existing workspace error UI.
    }
  }

  if (projectQuery.isPending || trajectoryQuery.isPending || settingsLoading) {
    return (
      <main className="flex h-screen items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex h-screen items-center justify-center p-6 text-xs text-destructive">
        {queryError instanceof Error ? queryError.message : "Project not found"}
      </main>
    );
  }

  return (
    <main
      className={`grid h-dvh min-h-0 grid-cols-1 overflow-hidden ${canEdit ? "grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_300px] md:grid-rows-1" : ""}`}
    >
      <TrajectoryPlaybackLoop trajectory={trajectory} />
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader project={project} projectId={projectId} />
        <ProjectScene
          deletingTrajectory={clearTrajectoryMutation.isPending}
          onDeleteTrajectory={() => void clearTrajectory()}
          project={project}
          projectId={projectId}
          rendererBackend={webGpuTileRenderer ? "webgpu" : "webgl"}
          trajectory={trajectory}
        />
      </div>
      {canEdit && (
        <ChatPanelContainer
          project={project}
          projectId={projectId}
          queryError={queryError instanceof Error ? queryError : null}
        />
      )}
    </main>
  );
}
