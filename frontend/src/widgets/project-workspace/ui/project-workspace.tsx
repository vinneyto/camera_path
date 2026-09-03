"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MousePointerClick } from "lucide-react";

import { projectApi } from "@/entities/project/api/project-api";
import type { ChatHistoryMessage, Project, Vec3 } from "@/entities/project/model/types";
import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { getAnchorLabel } from "@/features/anchor-creation/lib/get-anchor-label";
import { ChatPanel } from "@/features/chat-agent/ui/chat-panel";
import { useTrajectoryPlayback } from "@/features/trajectory-playback/model/use-trajectory-playback";
import { SceneCanvas } from "@/widgets/scene-editor/ui/scene-canvas";
import { PlaybackControls } from "@/widgets/trajectory-panels/ui/playback-controls";
import { TrajectoryInspector } from "@/widgets/trajectory-panels/ui/trajectory-inspector";
import { ProjectHeader } from "@/widgets/project-workspace/ui/project-header";

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [trajectory, setTrajectory] = useState<CompiledTrajectory | null>(null);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trajectorySelected, setTrajectorySelected] = useState(false);
  const playback = useTrajectoryPlayback(trajectory);
  const anchors = useMemo(() => project ? Object.values(project.anchors) : [], [project]);

  useEffect(() => {
    Promise.all([projectApi.get(projectId), projectApi.compile(projectId)])
      .then(([loadedProject, compiled]) => {
        setProject(loadedProject);
        setMessages(loadedProject.chat_history);
        setTrajectory(compiled);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function addAnchor(position: Vec3, normal: Vec3) {
    if (!project || mutating) return;
    setMutating(true);
    setError(null);
    try {
      const updated = await projectApi.addAnchor(project.id, {
        label: getAnchorLabel(Object.values(project.anchors)),
        surface_position: position.map((value) => Number(value.toFixed(4))) as Vec3,
        surface_normal: normal.map((value) => Number(value.toFixed(4))) as Vec3,
      });
      setProject(updated);
      setTrajectory(await projectApi.compile(project.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add anchor");
    } finally {
      setMutating(false);
    }
  }

  async function sendMessage(message: string) {
    if (!project || mutating) return;
    setMutating(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const result = await projectApi.chat(project.id, message);
      setProject(result.project);
      setMessages(result.project.chat_history);
      setTrajectory(result.compiled);
      if (result.compiled.position_segments.length > 0) setTrajectorySelected(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent request failed");
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return <main className="flex h-screen items-center justify-center"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></main>;
  }

  if (!project) {
    return <main className="flex h-screen items-center justify-center p-6 text-xs text-destructive">{error ?? "Project not found"}</main>;
  }

  return (
    <main className="grid h-screen min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-col">
        <ProjectHeader project={project} />
        <div className="relative min-h-[260px] flex-1">
          <SceneCanvas
            anchors={anchors}
            onAddAnchor={(position, normal) => void addAnchor(position, normal)}
            onSelectTrajectory={() => setTrajectorySelected(true)}
            pathPosition={playback.pathPosition}
            selected={trajectorySelected}
            trajectory={trajectory}
          />
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            {mutating ? <LoaderCircle className="size-3 animate-spin" /> : <MousePointerClick className="size-3" />}
            Click a primitive surface to place an anchor
          </div>
        </div>
        {trajectory && trajectory.position_segments.length > 0 && (
          <PlaybackControls
            duration={playback.duration}
            onSeek={playback.seek}
            onToggle={playback.toggle}
            pathPosition={playback.pathPosition}
            playing={playback.playing}
          />
        )}
        {trajectorySelected && trajectory && trajectory.position_segments.length > 0 && (
          <TrajectoryInspector
            onClose={() => setTrajectorySelected(false)}
            pathPosition={playback.pathPosition}
            project={project}
            trajectory={trajectory}
          />
        )}
      </div>
      <ChatPanel anchors={anchors} error={error} messages={messages} onSend={sendMessage} pending={mutating} />
    </main>
  );
}
