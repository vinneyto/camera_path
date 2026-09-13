"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { projectApi, type CameraOrientation } from "@/entities/project";

import { applyOrientationMutationResult } from "../lib/apply-orientation-mutation-result";

export function useUpdateDefaultCameraOrientation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orientation: CameraOrientation) =>
      projectApi.updateDefaultCameraOrientation(projectId, orientation),
    onSuccess: (project) =>
      applyOrientationMutationResult(queryClient, projectId, project),
  });
}
