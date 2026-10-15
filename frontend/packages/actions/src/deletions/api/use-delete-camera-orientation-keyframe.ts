"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "@camera-path/api/project";
import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useDeleteCameraOrientationKeyframe(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      projectApi.deleteCameraOrientationKeyframe(projectId, id),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}
