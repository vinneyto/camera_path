"use client";
import { Slot } from "@camera-path/slots";

import { LoaderCircle } from "lucide-react";

import {
  useCompiledTrajectoryQuery,
  useProjectQuery,
} from "@camera-path/api/project";
import { useUserSettings } from "@camera-path/store";

import { ProjectHeader } from "@host/ui/project-workspace/ui/project-header";
import { ProjectScene } from "@host/ui/project-workspace/ui/project-scene";

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { webGpuTileRenderer, loading: settingsLoading } = useUserSettings();
  const projectQuery = useProjectQuery(projectId);
  const trajectoryQuery = useCompiledTrajectoryQuery(projectId);
  const project = projectQuery.data;
  const queryError = projectQuery.error ?? trajectoryQuery.error;

  if (projectQuery.isPending || trajectoryQuery.isPending || settingsLoading) {
    return (
      <main className="flex h-full items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex h-full items-center justify-center p-6 text-xs text-destructive">
        {queryError instanceof Error ? queryError.message : "Project not found"}
      </main>
    );
  }

  return (
    <main className="grid h-full min-h-0 grid-cols-1 grid-rows-1 overflow-hidden [&:has([data-project-sidebar]>*)]:grid-rows-[minmax(0,1fr)_auto] md:[&:has([data-project-sidebar]>*)]:grid-cols-[minmax(0,1fr)_300px] md:[&:has([data-project-sidebar]>*)]:grid-rows-1">
      <Slot name="project.root" />
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader title={project.name} revision={project.revision} />
        <ProjectScene
          rendererBackend={webGpuTileRenderer ? "webgpu" : "webgl"}
        />
      </div>
      <div data-project-sidebar className="contents">
        <Slot name="project.sidebar" />
      </div>
    </main>
  );
}
