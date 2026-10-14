"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type CameraOrientation } from "@host/adapters/project";

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

export function useUpdateDefaultCameraOrientation(projectId: string) {
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
