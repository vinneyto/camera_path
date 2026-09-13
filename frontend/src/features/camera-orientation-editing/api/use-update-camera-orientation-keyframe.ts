"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeUpdate,
} from "@/entities/project";

import { applyOrientationMutationResult } from "../lib/apply-orientation-mutation-result";

interface UpdateCameraOrientationKeyframeVariables {
  keyframe: CameraOrientationKeyframeUpdate;
  keyframeId: string;
}

export function useUpdateCameraOrientationKeyframe(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      keyframe,
      keyframeId,
    }: UpdateCameraOrientationKeyframeVariables) =>
      projectApi.updateCameraOrientationKeyframe(
        projectId,
        keyframeId,
        keyframe,
      ),
    onSuccess: (project) =>
      applyOrientationMutationResult(queryClient, projectId, project),
  });
}
