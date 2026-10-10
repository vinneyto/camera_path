import Link from "next/link";
import { ArrowLeft, Boxes, MapPin } from "lucide-react";

import type { Project } from "@/entities/project";
import { ProjectCloudControls } from "@/features/project-clouds";
import { AuthControl, EditorOnly } from "@/features/auth";
import { Badge, Button, FLOATING_PANEL_Z_INDEX } from "@/shared/ui";

interface ProjectHeaderProps {
  project: Project;
  projectId: string;
}

export function ProjectHeader({ project, projectId }: ProjectHeaderProps) {
  return (
    <header
      className="relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border-b bg-background px-2 py-1 md:h-11 md:grid-cols-[minmax(0,1fr)_minmax(0,min(360px,28vw))_minmax(0,1fr)] md:px-2.5 md:py-0"
      style={{
        zIndex: FLOATING_PANEL_Z_INDEX + 1,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/">
          <Button
            aria-label="Back to projects"
            className="size-10 md:size-8"
            size="icon"
            variant="ghost"
          >
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
      <EditorOnly>
        <div className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
          <ProjectCloudControls projectId={projectId} />
        </div>
      </EditorOnly>
      <div className="col-start-2 flex min-w-0 items-center justify-end gap-2 md:col-start-3">
        <AuthControl />
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
