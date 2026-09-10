"use client";

import { LoaderCircle } from "lucide-react";

import {
  useCompiledTrajectoryQuery,
  useProjectQuery,
} from "@/entities/project";
import { TrajectoryPlaybackLoop } from "@/features/project-editor";

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
  const queryError = projectQuery.error ?? trajectoryQuery.error;

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
        <ProjectHeader project={project} />
        <ProjectScene
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
