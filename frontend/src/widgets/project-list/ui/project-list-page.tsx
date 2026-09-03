"use client";

import { useRouter } from "next/navigation";

import { useProjectsQuery } from "@/entities/project";
import { ProjectCreateForm, ProjectList, useCreateProject } from "@/features/project-selection";

export function ProjectListPage() {
  const router = useRouter();
  const projectsQuery = useProjectsQuery();
  const createProjectMutation = useCreateProject();
  const error = projectsQuery.error ?? createProjectMutation.error;

  async function createProject(name: string) {
    try {
      const project = await createProjectMutation.mutateAsync(name);
      router.push(`/projects/${project.id}`);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-12">
      <div className="mb-8">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Camera Path</p>
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-xs text-muted-foreground">Choose a saved scene or start a new trajectory.</p>
      </div>
      <div className="mb-4">
        <ProjectCreateForm disabled={createProjectMutation.isPending} onCreate={createProject} />
      </div>
      {error && (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {error instanceof Error ? error.message : "Could not load projects"}
        </p>
      )}
      <ProjectList loading={projectsQuery.isPending} projects={projectsQuery.data ?? []} />
    </main>
  );
}
