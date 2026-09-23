"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type CameraOrientation } from "@/entities/project";

import { invalidateProjectResource } from "@/entities/project/api/invalidate-project-resource";

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
