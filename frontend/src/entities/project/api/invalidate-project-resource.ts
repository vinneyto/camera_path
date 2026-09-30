import type { QueryClient } from "@tanstack/react-query";

import { projectKeys } from "./project-queries";

type Resource =
  | "anchors"
  | "scenePoints"
  | "segments"
  | "speed"
  | "aim"
  | "orientation"
  | "depthOfField"
  | "chat"
  | "all";

export async function invalidateProjectResource(
  queryClient: QueryClient,
  projectId: string,
  resource: Resource,
) {
  const keys = [
    projectKeys.detail(projectId),
    projectKeys.anchors(projectId),
    projectKeys.scenePoints(projectId),
    projectKeys.segments(projectId),
    projectKeys.speed(projectId),
    projectKeys.aim(projectId),
    projectKeys.orientation(projectId),
    projectKeys.depthOfField(projectId),
    projectKeys.chat(projectId),
  ];
  const target = {
    anchors: 1,
    scenePoints: 2,
    segments: 3,
    speed: 4,
    aim: 5,
    orientation: 6,
    depthOfField: 7,
    chat: 8,
  } as const;
  const affected = resource === "all" ? keys : [keys[target[resource]]];
  if (resource !== "chat") {
    affected.push(projectKeys.trajectory(projectId));
  }
  await Promise.all([
    ...affected.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ...(resource === "anchors" || resource === "segments" || resource === "all"
      ? [queryClient.invalidateQueries({ queryKey: projectKeys.list() })]
      : []),
  ]);
}
