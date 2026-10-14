"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeUpdate,
} from "@host/adapters/project";

interface UpdateCameraOrientationKeyframeVariables {
  keyframe: CameraOrientationKeyframeUpdate;
  keyframeId: string;
}

import { invalidateProjectResource } from "@host/adapters/project/invalidate-project-resource";

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
    onSuccess: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
    onError: () =>
      invalidateProjectResource(queryClient, projectId, "orientation"),
  });
}
