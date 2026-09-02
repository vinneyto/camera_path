"use client";

import Link from "next/link";
import { ArrowRight, Box, LoaderCircle } from "lucide-react";

import type { Project } from "@/entities/project/model/types";
import { Card } from "@/shared/ui/card";

interface ProjectListProps {
  loading: boolean;
  projects: Project[];
}

export function ProjectList({ loading, projects }: ProjectListProps) {
  if (loading) {
    return <LoaderCircle className="mx-auto mt-16 size-5 animate-spin text-muted-foreground" />;
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-xs text-muted-foreground">
        No projects yet. Create one to start placing camera-path anchors.
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {projects.map((project) => (
        <Link href={`/projects/${project.id}`} key={project.id}>
          <Card className="group flex items-center gap-3 p-3 transition-colors hover:bg-accent">
            <div className="flex size-8 items-center justify-center rounded-md bg-secondary">
              <Box className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{project.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {Object.keys(project.anchors).length} anchors · {project.segments.length} segments
              </p>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
