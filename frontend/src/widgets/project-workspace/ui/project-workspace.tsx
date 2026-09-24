"use client";

import { LoaderCircle } from "lucide-react";

import {
  useCompiledTrajectoryQuery,
  useProjectQuery,
} from "@/entities/project";
import {
  TrajectoryPlaybackLoop,
  useHoveredTrajectory,
  useTrajectoryPlayback,
  useTrajectorySelection,
} from "@/features/project-editor";
import { useClearTrajectory } from "@/features/object-deletion";

import { ChatPanelContainer } from "./chat-panel-container";
import { ProjectHeader } from "./project-header";
import { ProjectScene } from "./project-scene";

interface ProjectWorkspaceProps {
  projectId: string;
  rendererBackend?: "webgl" | "webgpu";
}

export function ProjectWorkspace({
  projectId,
  rendererBackend = "webgpu",
}: ProjectWorkspaceProps) {
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
        {queryError instanceof Error ? queryError.message : "Project not found"}
      </main>
    );
  }

  return (
    <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
      <TrajectoryPlaybackLoop trajectory={trajectory} />
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader project={project} projectId={projectId} />
        <ProjectScene
          deletingTrajectory={clearTrajectoryMutation.isPending}
          onDeleteTrajectory={() => void clearTrajectory()}
          project={project}
          projectId={projectId}
          rendererBackend={rendererBackend}
          trajectory={trajectory}
        />
      </div>
      <ChatPanelContainer
        project={project}
        projectId={projectId}
        queryError={queryError instanceof Error ? queryError : null}
      />
    </main>
  );
}
