"use client";

import Link from "next/link";
import { ArrowRight, Box, LoaderCircle } from "lucide-react";
import { useState } from "react";

import type { Project } from "@/entities/project";
import { Card, ContextMenu, type ContextMenuPosition } from "@/shared/ui";

interface ProjectListProps {
  deletingProjectId?: string;
  loading: boolean;
  onDelete: (project: Project) => void;
  projects: Project[];
}

interface ProjectMenuState extends ContextMenuPosition {
  project: Project;
}

export function ProjectList({ deletingProjectId, loading, onDelete, projects }: ProjectListProps) {
  const [menu, setMenu] = useState<ProjectMenuState | null>(null);

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
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {projects.map((project) => (
          <Link
            href={`/projects/${project.id}`}
            key={project.id}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ project, x: event.clientX, y: event.clientY });
            }}
          >
            <Card className="group flex items-center gap-3 p-3 transition-colors hover:bg-accent">
              <div className="flex size-8 items-center justify-center rounded-md bg-secondary">
                {deletingProjectId === project.id
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Box className="size-4" />}
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
      <ContextMenu
        items={menu ? [{
          destructive: true,
          disabled: deletingProjectId === menu.project.id,
          label: "Delete project",
          onSelect: () => onDelete(menu.project),
        }] : []}
        onClose={() => setMenu(null)}
        position={menu}
      />
    </>
  );
}
