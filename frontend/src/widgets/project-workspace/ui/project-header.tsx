import Link from "next/link";
import { ArrowLeft, Boxes, MapPin } from "lucide-react";

import type { Project } from "@/entities/project";
import { GaussianDprSelect } from "@/features/gaussian-rendering-settings";
import { ProjectCloudControls } from "@/features/project-clouds";
import { ThemeToggle } from "@/features/theme-switcher";
import { Badge, Button, FLOATING_PANEL_Z_INDEX } from "@/shared/ui";

interface ProjectHeaderProps {
  project: Project;
  projectId: string;
}

export function ProjectHeader({ project, projectId }: ProjectHeaderProps) {
  return (
    <header
      className="relative grid h-11 shrink-0 items-center gap-2 border-b bg-background px-2.5"
      style={{
        gridTemplateColumns:
          "minmax(0, 1fr) minmax(0, min(360px, 28vw)) minmax(0, 1fr)",
        zIndex: FLOATING_PANEL_Z_INDEX + 1,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/">
          <Button aria-label="Back to projects" size="icon" variant="ghost">
            <ArrowLeft className="size-3.5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xs font-semibold">{project.name}</h1>
          <p className="text-[9px] text-muted-foreground">
            Revision {project.revision}
          </p>
        </div>
      </div>
      <div className="min-w-0">
        <ProjectCloudControls projectId={projectId} />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="hidden lg:block">
          <GaussianDprSelect />
        </div>
        <ThemeToggle />
        <Badge className="hidden gap-1 2xl:inline-flex">
          <MapPin className="size-2.5" />
          {Object.keys(project.anchors).length}
        </Badge>
        <Badge className="hidden gap-1 2xl:inline-flex">
          <Boxes className="size-2.5" />
          {project.segments.length}
        </Badge>
      </div>
    </header>
  );
}
