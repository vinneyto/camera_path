"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@camera-path/api/project";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useDeleteCameraKeyframe(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectApi.deleteCameraKeyframe(projectId, id),
    onSuccess: () => invalidateProjectResource(queryClient, projectId, "aim"),
    onError: () => invalidateProjectResource(queryClient, projectId, "aim"),
  });
}
