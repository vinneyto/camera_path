import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ExtensionSlot } from "@camera-path/extension-api";
import { Button, FLOATING_PANEL_Z_INDEX } from "@camera-path/ui-kit";
import { WorkspaceCommands } from "@host/ui/commands/workspace-commands";
import { AuthControl } from "@host/ui/header";

interface ProjectHeaderProps {
  title: string;
  revision: number;
}

export function ProjectHeader({ title, revision }: ProjectHeaderProps) {
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
          <h1 className="truncate text-xs font-semibold">{title}</h1>
          <p className="text-[9px] text-muted-foreground">
            Revision {revision}
          </p>
        </div>
      </div>
      <div className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
        <WorkspaceCommands />
      </div>
      <div className="col-start-2 flex min-w-0 items-center justify-end gap-2 md:col-start-3">
        <AuthControl />
        <ExtensionSlot name="project.header.status" />
      </div>
    </header>
  );
}
