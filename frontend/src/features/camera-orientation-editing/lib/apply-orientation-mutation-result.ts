import type { QueryClient } from "@tanstack/react-query";

import { projectKeys, type Project } from "@/entities/project";

export function applyOrientationMutationResult(
  queryClient: QueryClient,
  projectId: string,
  project: Project,
): void {
  queryClient.setQueryData(projectKeys.detail(projectId), project);
  void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
  void queryClient.invalidateQueries({
    queryKey: projectKeys.trajectory(projectId),
  });
}
