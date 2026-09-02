import Link from "next/link";
import { ArrowLeft, Boxes, MapPin } from "lucide-react";

import type { Project } from "@/entities/project/model/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-2.5">
      <Link href="/">
        <Button aria-label="Back to projects" size="icon" variant="ghost">
          <ArrowLeft className="size-3.5" />
        </Button>
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xs font-semibold">{project.name}</h1>
        <p className="text-[9px] text-muted-foreground">Revision {project.revision}</p>
      </div>
      <Badge className="gap-1"><MapPin className="size-2.5" />{Object.keys(project.anchors).length}</Badge>
      <Badge className="gap-1"><Boxes className="size-2.5" />{project.segments.length}</Badge>
    </header>
  );
}
