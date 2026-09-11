"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeCreate,
} from "@/entities/project";

import { applyOrientationMutationResult } from "../lib/apply-orientation-mutation-result";

export function useAddCameraOrientationKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyframe: CameraOrientationKeyframeCreate) =>
      projectApi.addCameraOrientationKeyframe(projectId, keyframe),
    onSuccess: (project) =>
      applyOrientationMutationResult(queryClient, projectId, project),
  });
}
