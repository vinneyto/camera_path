"use client";
import { useProjectId } from "@camera-path/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  projectApi,
  type CameraOrientationKeyframeUpdate,
} from "@camera-path/api/project";

interface UpdateCameraOrientationKeyframeVariables {
  keyframe: CameraOrientationKeyframeUpdate;
  keyframeId: string;
}

import { invalidateProjectResource } from "@camera-path/api/project/invalidate-project-resource";

export function useUpdateCameraOrientationKeyframe(explicitProjectId?: string) {
  const projectId = useProjectId(explicitProjectId);
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
