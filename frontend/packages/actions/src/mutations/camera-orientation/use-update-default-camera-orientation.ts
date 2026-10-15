"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type CameraOrientation } from "@camera-path/api/project";

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useUpdateDefaultCameraOrientation(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orientation: CameraOrientation) =>
      projectApi.updateDefaultCameraOrientation(projectId, orientation),
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}
