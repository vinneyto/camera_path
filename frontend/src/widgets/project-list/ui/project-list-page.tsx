"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { projectApi } from "@/entities/project/api/project-api";
import type { Project } from "@/entities/project/model/types";
import { ProjectCreateForm } from "@/features/project-selection/ui/project-create-form";
import { ProjectList } from "@/features/project-selection/ui/project-list";

export function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    projectApi.list()
      .then(setProjects)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function createProject(name: string) {
    setCreating(true);
    setError(null);
    try {
      const project = await projectApi.create(name);
      router.push(`/projects/${project.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create project");
      setCreating(false);
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
        <ProjectCreateForm disabled={creating} onCreate={createProject} />
      </div>
      {error && <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>}
      <ProjectList loading={loading} projects={projects} />
    </main>
  );
}
