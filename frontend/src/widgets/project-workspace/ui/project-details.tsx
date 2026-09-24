"use client";

import Link from "next/link";

import { useGetProject } from "@/shared/api/generated/client";
import { ProjectCloudPanel } from "@/features/project-clouds";
import { Button } from "@/shared/ui";

interface ProjectDetailsProps {
  projectId: string;
}

export function ProjectDetails({ projectId }: ProjectDetailsProps) {
  const project = useGetProject(projectId);
  if (project.isPending) return <main className="p-8">Loading project…</main>;
  if (project.error || !project.data || project.data.status !== 200)
    return (
      <main className="p-8 text-destructive">Could not load project.</main>
    );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-12">
      <Link className="text-xs text-muted-foreground hover:underline" href="/">
        ← Projects
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{project.data.data.name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage clouds from the library and edit the scene.
        </p>
      </div>
      <ProjectCloudPanel projectId={projectId} />
      <div className="flex gap-3">
        <Link href={`/projects/${projectId}/viewer`}>
          <Button>Open viewer</Button>
        </Link>
        <Link className="self-center text-xs underline" href="/library">
          Open library
        </Link>
      </div>
    </main>
  );
}
